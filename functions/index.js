// functions/index.js

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// ===== Cloud Function: Soil Monitoring =====
export const smartAgriSoilMonitor = onDocumentCreated(
  "farmgroups/{farmGroupId}/devices/{deviceId}/readings/{readingId}",
  async (event) => {
    try {
      const data = event.data.data();

      // ✅ FIX: get deviceId and farmGroupId from path params, NOT from data
      const deviceId    = event.params.deviceId;
      const farmGroupId = event.params.farmGroupId;

      const { soilMoisture, soilStatus, growthstage, time } = data;

      console.log(`📌 New reading from device ${deviceId} in farmGroup ${farmGroupId}`);
      console.log(`Time: ${time}`);
      console.log(`Soil Moisture: ${soilMoisture} %`);
      console.log(`Soil Status: ${soilStatus}`);
      console.log(`Growth Stage: ${growthstage}`);

      // ===== Thresholds based on growth stage =====
      let lowerThreshold = 0;
      let upperThreshold = 0;

      switch (growthstage) {
        case "VEGETATIVE":    lowerThreshold = 16; upperThreshold = 22; break;
        case "BUD FORMATION": lowerThreshold = 18; upperThreshold = 25; break;
        case "FLOWERING":     lowerThreshold = 20; upperThreshold = 25; break;
        case "POST FLOWERING":lowerThreshold = 12; upperThreshold = 19; break;
        default:              lowerThreshold = 18; upperThreshold = 30;
      }

      // ===== Determine if an alert is needed =====
      let alertTitle = "";
      let alertBody  = "";
      let shouldAlert = false;

      if (soilMoisture < lowerThreshold) {
        alertTitle  = "⚠️ Soil Too Dry";
        alertBody   = `Device ${deviceId} reports low soil moisture (${soilMoisture}%). Irrigation started.`;
        shouldAlert = true;
      } else if (soilMoisture > upperThreshold) {
        alertTitle  = "💧 Soil Too Wet";
        alertBody   = `Device ${deviceId} reports high soil moisture (${soilMoisture}%). Irrigation stopped.`;
        shouldAlert = true;
      } else {
        console.log("✅ Soil moisture is optimal. No alert needed.");
      }

      if (!shouldAlert) return;

      // ===== Fetch all users in the same farm group =====
      const usersSnap = await db
        .collection("users")
        .where("selectedFarmGroupId", "==", farmGroupId)
        .get();

      if (usersSnap.empty) {
        console.log(`⚠️ No users found with selectedFarmGroupId == ${farmGroupId}`);
        return;
      }

      // ===== Batch write notifications =====
      const batch = db.batch();

      usersSnap.forEach((userDoc) => {
        const notifRef = db
          .collection("users")
          .doc(userDoc.id)
          .collection("notifications")
          .doc();

        batch.set(notifRef, {
          title:     alertTitle,
          body:      alertBody,
          deviceId:  deviceId,
          type:      "alert",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          read:      false,
        });
      });

      await batch.commit();
      console.log(`✅ Notifications sent to ${usersSnap.size} users.`);

    } catch (err) {
      console.error("❌ Error in smartAgriSoilMonitor:", err);
    }
  }
);