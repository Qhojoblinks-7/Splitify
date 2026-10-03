import { Alert as NativeAlert } from "react-native";

let handler = null;

export function registerFeedbackHandler(next) {
  handler = next;
}

function fallback(title, message, buttons) {
  if (NativeAlert && typeof NativeAlert.alert === "function") {
    NativeAlert.alert(title, message, buttons);
  }
}

/**
 * Drop-in replacement for the native `Alert`.
 *
 * Usage mirrors react-native's Alert, with one extra `options` argument:
 *   Alert.alert(title, message?, buttons?, { variant })
 *
 * Routing rules (handled centrally by the provider):
 *   - notifications (no action buttons) render as a themed toast
 *   - prompts (one or more action buttons) render as a themed dialog
 *
 * Supported variants: "success" | "error" | "warning" | "info" | "danger" | "confirm"
 */
export const Alert = {
  alert(title, message, buttons, options) {
    if (handler) {
      return handler.alert(title, message, buttons, options);
    }
    return fallback(title, message, buttons);
  },
};

function show(message, variant, options = {}) {
  if (handler) {
    return handler.toast(message, variant, options);
  }
  return fallback(options.title, message, [{ text: "OK" }]);
}

/** Themed, non-blocking status messages. */
export const toast = {
  show,
  success(message, options) {
    return show(message, "success", options);
  },
  error(message, options) {
    return show(message, "error", options);
  },
  warning(message, options) {
    return show(message, "warning", options);
  },
  info(message, options) {
    return show(message, "info", options);
  },
};

export default Alert;
