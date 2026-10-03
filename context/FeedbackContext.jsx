import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import GrowlDialog from "../components/molecule/GrowlDialog";
import GrowlToast from "../components/molecule/GrowlToast";
import { registerFeedbackHandler } from "../utils/alert";

const FeedbackContext = createContext(null);

const VARIANT_BY_KEYWORD = [
  [/fail|error|unable|invalid|missing|could ?n[o']t|cannot|declin|reject/i, "error"],
  [/warn|pending|miss|owes|owe\b|flag|removed|revoked/i, "warning"],
  [/logged|started|released|received|complete|closed|sent|verified|success/i, "success"],
];

function inferVariant(title = "", message = "") {
  const haystack = `${title} ${message}`;
  for (const [pattern, variant] of VARIANT_BY_KEYWORD) {
    if (pattern.test(haystack)) return variant;
  }
  return "info";
}

export function FeedbackProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [queue, setQueue] = useState([]);
  const counter = useRef(0);
  const active = queue.length ? queue[0] : null;

  const closeDialog = useCallback(() => setDialog(null), []);

  const enqueue = useCallback((item) => {
    counter.current += 1;
    const entry = { ...item, id: `toast-${counter.current}` };
    setQueue((current) => {
      // Keep the stack shallow: the newest message always wins over stale ones.
      const sameKey = current.filter(
        (t) => !(t.title === entry.title && t.message === entry.message)
      );
      return [...sameKey, entry].slice(-2);
    });
    return entry;
  }, []);

  const removeToast = useCallback((id) => {
    setQueue((current) => current.filter((t) => t.id !== id));
  }, []);

  const requestToast = useCallback(
    (message, variant, options = {}) => {
      if (!message) return null;
      return enqueue({
        title: options.title,
        message,
        variant: options.variant || variant || "info",
        duration: options.duration,
      });
    },
    [enqueue]
  );

  const requestDialog = useCallback((config) => setDialog(config), []);

  const requestAlert = useCallback(
    (title, message, buttons, options = {}) => {
      const variant = options.variant || inferVariant(title, message || "");
      const isNotification = !buttons || buttons.every((b) => typeof b.onPress !== "function");

      if (isNotification) {
        return requestToast(message || title, variant, { title: message ? title : undefined, ...options });
      }

      return requestDialog({ title, message, variant, buttons });
    },
    [requestDialog, requestToast]
  );

  useEffect(() => {
    registerFeedbackHandler({
      alert: requestAlert,
      toast: requestToast,
    });
    return () => registerFeedbackHandler(null);
  }, [requestAlert, requestToast]);

  const value = useMemo(
    () => ({ alert: requestAlert, dialog: requestDialog, closeDialog, toast: requestToast }),
    [requestAlert, requestDialog, requestToast, closeDialog]
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <GrowlDialog
        visible={Boolean(dialog)}
        title={dialog && dialog.title}
        message={dialog && dialog.message}
        variant={dialog && dialog.variant}
        buttons={dialog && dialog.buttons}
        onClose={closeDialog}
      />
      <GrowlToast toast={active} onExited={removeToast} />
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error("useFeedback must be used inside a FeedbackProvider");
  }
  return ctx;
}

export default FeedbackProvider;
