import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import BottomSheet from "../../components/molecule/BottomSheet";
import BaseButton from "../../components/atoms/BaseButton";
import { useTabBarStore } from "../../store/tabBar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SCANNER_SIZE = 260;

export default function Scan() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setMode, setCustomButtons } = useTabBarStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [isSheetVisible, setSheetVisible] = useState(false);
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setMode("scan");
    return () => {
      setMode("tabs");
      setCustomButtons([]);
    };
  }, []);

  useEffect(() => {
    if (!scanned) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: SCANNER_SIZE - 50,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.reset();
    }
  }, [scanned]);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = ({ type, data }) => {
    if (scanned) return;
    setScanned(true);
    setScanResult({ type, data });
    setSheetVisible(true);
    setCustomButtons([
      {
        label: "Dismiss",
        variant: "cancel",
        onPress: () => {
          setScanned(false);
          setScanResult(null);
          setSheetVisible(false);
          setCustomButtons([]);
        },
      },
      {
        label: "Continue",
        variant: "primary",
        onPress: () => {
          setScanned(false);
          setScanResult(null);
          setSheetVisible(false);
          setCustomButtons([]);
        },
      },
    ]);
  };

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color="#fbb81c" />
          </Pressable>
          <Text style={styles.headerTitle}>Scan</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            Please grant camera access to scan QR codes and barcodes.
          </Text>
          <BaseButton
            title="Grant Permission"
            onPress={() => requestPermission()}
            style={{ marginTop: 24, width: 200 }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#fbb81c" />
        </Pressable>
        <Text style={styles.headerTitle}>Scan</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          type="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          ratio="1:1"
        >
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    transform: [{ translateY: scanLineAnim }],
                  },
                ]}
              />

              <Text style={styles.scanText}>Align barcode within the frame</Text>
            </View>
          </View>
        </CameraView>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Point camera at QR code or barcode</Text>
      </View>

      <BottomSheet
        isVisible={isSheetVisible}
        onClose={() => {
          setScanned(false);
          setScanResult(null);
          setSheetVisible(false);
          setCustomButtons([]);
        }}
        title="Scan Result"
      >
        <View style={styles.sheetContent}>
          <View style={styles.resultIcon}>
            <Text style={styles.resultIconText}>✓</Text>
          </View>
          <Text style={styles.resultTitle}>Scan Successful</Text>
          <Text style={styles.resultData} numberOfLines={3}>
            {scanResult?.data || "No data"}
          </Text>
          <Text style={styles.resultType}>{scanResult?.type || ""}</Text>
          <View style={styles.resultButtons}>
            <BaseButton
              title="Dismiss"
              variant="outline"
              onPress={() => {
                setScanned(false);
                setScanResult(null);
                setSheetVisible(false);
                setCustomButtons([]);
              }}
              style={{ flex: 1, marginRight: 8 }}
            />
            <BaseButton
              title="Continue"
              onPress={() => {
                setScanned(false);
                setScanResult(null);
                setSheetVisible(false);
                setCustomButtons([]);
              }}
              style={{ flex: 1, marginLeft: 8 }}
            />
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#16171b",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: {
    padding: 8,
    width: 40,
    alignItems: "flex-start",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
  },
  cameraContainer: {
    flex: 1,
    marginHorizontal: 0,
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scannerFrame: {
    width: SCANNER_SIZE,
    height: SCANNER_SIZE,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#fbb81c",
    borderWidth: 3,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 8,
  },
  scanLine: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: "#fbb81c",
    shadowColor: "#fbb81c",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  scanText: {
    color: "#ffffff",
    fontSize: 13,
    marginTop: SCANNER_SIZE / 2 + 20,
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  footer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  footerText: {
    color: "#8e8e93",
    fontSize: 14,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  permissionTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
  },
  permissionText: {
    color: "#8e8e93",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: "center",
  },
  resultIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fbb81c",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  resultIconText: {
    color: "#16171b",
    fontSize: 28,
    fontWeight: "bold",
  },
  resultTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  resultData: {
    color: "#8e8e93",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 6,
    maxWidth: "100%",
  },
  resultType: {
    color: "#fbb81c",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 24,
    textTransform: "uppercase",
  },
  resultButtons: {
    flexDirection: "row",
    width: "100%",
  },
});
