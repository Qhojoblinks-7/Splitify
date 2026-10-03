import { Linking } from "react-native";
import { Alert } from "./alert";

export function openEmail(address, subject, body) {
  const params = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  const query = params.length ? `?${params.join("&")}` : "";
  const url = `mailto:${address}${query}`;

  return Linking.canOpenURL(url)
    .then((supported) => {
      if (!supported) throw new Error("mailto: is not supported on this device");
      return Linking.openURL(url);
    })
    .catch(() => {
      Alert.alert(
        "Unable to open email",
        `Please email ${address} directly from your email app.`,
        undefined,
        { variant: "error" }
      );
    });
}

export default openEmail;
