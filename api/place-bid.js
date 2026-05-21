import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin (Only once)
if (!getApps().length) {
  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
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

  const { uid, auctionId, bidAmount, robloxName } = req.body;

  if (!uid || !auctionId || typeof bidAmount !== 'number' || bidAmount <= 0) {
    return res.status(400).json({ success: false, message: 'ข้อมูลการเสนอราคาไม่ครบถ้วน' });
  }

  // Ensure Firebase Admin is initialized
  if (!getApps().length) {
    return res.status(500).json({ success: false, message: 'ระบบหลังบ้านทำงานผิดพลาด (Firebase Admin Not Configured)' });
  }
  
  const db = getFirestore();

  try {
    const auctionRef = db.collection('auctions').doc(auctionId);
    const userRef = db.collection('users').doc(uid);

    const result = await db.runTransaction(async (t) => {
      // 1. อ่านข้อมูลการประมูลแบบสตรีมล่าสุด
      const auctionDoc = await t.get(auctionRef);
      if (!auctionDoc.exists) {
        throw new Error('ไม่พบข้อมูลรายการประมูลนี้');
      }

      const auctionData = auctionDoc.data();

      // ตรวจสอบสถานะการประมูล
      if (auctionData.status !== 'active') {
        throw new Error('การประมูลรายการนี้สิ้นสุดหรือถูกยกเลิกแล้ว');
      }

      // ตรวจสอบวันสิ้นสุด
      const endsAt = auctionData.endsAt;
      const endTime = (endsAt && typeof endsAt.toDate === 'function') ? endsAt.toDate() : new Date(endsAt);
      if (endTime <= new Date()) {
        throw new Error('หมดเวลาการเสนอราคาประมูลแล้ว!');
      }

      // 2. คำนวณราคาประมูลขั้นต่ำที่ต้องการเสนอ
      const currentBid = auctionData.currentBid || 0;
      const minIncrement = auctionData.minIncrement || 0;
      const startingPrice = auctionData.startingPrice || 0;
      const bidsCount = auctionData.bidsCount || 0;

      const minRequiredBid = bidsCount > 0 ? (currentBid + minIncrement) : startingPrice;

      if (bidAmount < minRequiredBid) {
        throw new Error(`ราคาเสนอของคุณต่ำเกินไป! เสนอราคาขั้นต่ำคือ ${minRequiredBid} บาท`);
      }

      // 3. ดึงและเช็คโปรไฟล์ผู้เสนอราคาสมาชิก
      const userDoc = await t.get(userRef);
      if (!userDoc.exists) {
        throw new Error('ไม่พบข้อมูลกระเป๋าเงินสำหรับสมาชิกนี้');
      }

      const userData = userDoc.data();
      const userWallet = userData.virtualWallet || 0;

      // คำนวณยอดที่จะต้องหักเพิ่มจริงใน Wallet
      // (ถ้าคนเสนอราคาสูงสุดเป็นคนเดิม เสนอบับยอดเพิ่ม จะหักเพิ่มเฉพาะส่วนต่างเท่านั้น!)
      let amountToDeduct = bidAmount;
      if (auctionData.currentBidderUid === uid) {
        amountToDeduct = bidAmount - currentBid;
      }

      if (userWallet < amountToDeduct) {
        throw new Error(`ยอดเงินคงเหลือในกระเป๋าของคุณไม่เพียงพอสำหรับการประมูลนี้ (ต้องการเงินอีก ${amountToDeduct - userWallet} บาท)`);
      }

      // 4. คืนเงินให้ผู้เสนอราคาสูงสุดคนก่อนหน้า (ถ้าไม่ใช่ตัวเราเอง)
      const prevBidderUid = auctionData.currentBidderUid;
      const prevBid = auctionData.currentBid;

      if (prevBidderUid && prevBidderUid !== uid && prevBid > 0) {
        const prevBidderRef = db.collection('users').doc(prevBidderUid);
        t.update(prevBidderRef, {
          virtualWallet: FieldValue.increment(prevBid)
        });
      }

      // 5. หักเงินในกระเป๋าผู้ประมูลรายใหม่
      t.update(userRef, {
        virtualWallet: FieldValue.increment(-amountToDeduct)
      });

      // 6. อัปเดตข้อมูลการประมูลสูงสุด
      const bidderName = userData.displayName || 'สมาชิก SailorPiece';
      const finalRobloxName = robloxName || userData.robloxName || 'ไม่ได้ตั้งชื่อ';

      t.update(auctionRef, {
        currentBid: bidAmount,
        currentBidderUid: uid,
        currentBidderName: bidderName,
        currentBidderRoblox: finalRobloxName,
        bidsCount: FieldValue.increment(1)
      });

      // 7. บันทึกประวัติในคอลเลกชันประมูลย่อย
      const bidLogRef = auctionRef.collection('bids').doc();
      t.set(bidLogRef, {
        uid,
        bidderName,
        robloxName: finalRobloxName,
        bidAmount,
        timestamp: FieldValue.serverTimestamp()
      });

      return {
        newBid: bidAmount,
        deducted: amountToDeduct
      };
    });

    return res.status(200).json({ 
      success: true, 
      message: `คุณเสนอราคาประมูลสำเร็จที่ยอด ${result.newBid} บาท (หักเงิน Wallet จำนวน ${result.deducted} บาท)`,
      newBid: result.newBid
    });

  } catch (error) {
    console.error('Place Bid Server Error:', error);
    return res.status(400).json({ 
      success: false, 
      message: error.message || 'เกิดข้อผิดพลาดในการประมวลผลการประมูล'
    });
  }
}
