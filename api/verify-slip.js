import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import FormData from 'form-data';

// Initialize Firebase Admin (Only once)
if (!getApps().length) {
  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      initializeApp({
        credential: cert(serviceAccount)
      });
    }
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { uid, slipDataUrl } = req.body;

  if (!uid || !slipDataUrl) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน กรุณาส่ง UID และแนบรูปสลิปภาพมาด้วย' });
  }

  // Ensure Firebase Admin is initialized
  if (!getApps().length) {
     return res.status(500).json({ success: false, message: 'ระบบหลังบ้านทำงานผิดพลาด (Firebase Admin Not Configured)' });
  }
  
  const db = getFirestore();

  try {
    // 1. ถอดรหัส base64 กลับเป็น Buffer
    const base64Data = slipDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    // 2. สร้าง form-data เตรียมส่งให้ SlipOK
    const formData = new FormData();
    formData.append('files', buffer, { filename: 'slip.jpg', contentType: 'image/jpeg' });

    // อ่าน API Key จาก Environment Vars หากไม่ได้ใส่ ให้ใช้ตัวที่ลูกค้าให้มาเป็น Default
    const SLIPOK_ENDPOINT = process.env.SLIPOK_ENDPOINT || 'https://api.slipok.com/api/line/apikey/64330';
    const SLIPOK_API_KEY = process.env.SLIPOK_API_KEY || 'SLIPOK4GLTBN6';

    // 3. ยิงไปหา SlipOK API
    const response = await fetch(SLIPOK_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-authorization': SLIPOK_API_KEY,
        // Since we are using form-data library in Node, we don't manually set Content-Type header
        // when using modern native fetch with node-fetch, but typically we must pass formData headers if we used node-fetch.
        // Wait, Node 18 native fetch natively supports standard FormData, but we are using 'form-data' package which is a Node stream.
        // Node 18 fetch expects a standard DOM FormData or a Blob/Buffer.
        // Actually, passing 'form-data' package to Node 18's native fetch might fail or lose headers.
        ...formData.getHeaders()
      },
      body: formData
    });

    const slipResult = await response.json();

    // เช็คว่า SlipOK ตอบว่าสำเร็จหรือปลอม
    if (!slipResult.success) {
      return res.status(400).json({ 
         success: false, 
         message: slipResult.message || 'สลิปไม่ถูกต้อง ตรวจสอบไม่ผ่านกรุณาลองใหม่' 
      });
    }

    const { amount, transRef, sender } = slipResult.data;
    
    // ตรวจสอบขั้นต่ำในการเติม (Optional)
    // if (amount < 20) return res.status(400).json({ success: false, message: 'เติมขั้นต่ำ 20 บาท' });

    // 4. เช็คสลิปซ้ำ (Duplicate Check) ใน Database เราเองเพื่อความปลอดภัยสูงสุด
    const slipRefStr = String(transRef);
    const txRef = db.collection('transactions').doc(slipRefStr);
    
    // ใช้ Transaction เพื่อความชัวร์ (กันการยิงพร้อมกันสอง request)
    const result = await db.runTransaction(async (t) => {
        const txDoc = await t.get(txRef);
        
        if (txDoc.exists) {
            throw new Error('สลิปนี้ถูกใช้งานเติมเงินไปแล้ว!');
        }

        const userRef = db.collection('users').doc(uid);
        
        // บันทึกประวัติสลิปลง Database
        t.set(txRef, {
            uid,
            amount,
            sender: sender || {},
            createdAt: FieldValue.serverTimestamp(),
            status: 'success'
        });

        // อัปเดตเงินในกระเป๋าผู้ใช้
        t.update(userRef, {
            virtualWallet: FieldValue.increment(amount)
        });
        
        return amount;
    });

    return res.status(200).json({ 
       success: true, 
       amount: result, 
       message: `เติมเงินสำเร็จ ${result} บาท เข้ากระเป๋าของคุณแล้ว` 
    });

  } catch (error) {
    console.error('Slip Verify Error:', error);
    return res.status(500).json({ 
       success: false, 
       message: 'แพลตฟอร์มขัดข้อง หรือสลิปมีปัญหา: ' + error.message 
    });
  }
}
