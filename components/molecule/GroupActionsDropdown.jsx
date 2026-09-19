import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Modal, Animated, StyleSheet, Dimensions } from "react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const DROPDOWN_WIDTH = 180;

export default function GroupActionsDropdown({ isVisible, onClose, anchorRect, onSelect }) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.9));

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.9, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [isVisible, fadeAnim, scaleAnim]);

  if (!isVisible) return null;

  let dropdownRight = 20;
  let dropdownTop = 80;

  if (anchorRect && anchorRect.pageX !== undefined) {
    dropdownRight = SCREEN_WIDTH - anchorRect.pageX - anchorRect.width + 20;
    dropdownTop = anchorRect.pageY + anchorRect.height + 8;
  }

  if (dropdownTop + 200 > SCREEN_HEIGHT) {
    dropdownTop = Math.max(8, anchorRect ? anchorRect.pageY - 200 : 80);
  }

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.backdropTouch}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            styles.dropdown,
            {
              top: dropdownTop,
              right: dropdownRight,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.arrow} />
          <View style={styles.menu}>
            <TouchableOpacity
              style={styles.item}
              onPress={() => { onSelect?.("edit"); onClose(); }}
            >
              <Text style={styles.itemText}>Edit Group</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.item}
              onPress={() => { onSelect?.("members"); onClose(); }}
            >
              <Text style={styles.itemText}>Manage Members</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.item}
              onPress={() => { onSelect?.("analytics"); onClose(); }}
            >
              <Text style={styles.itemText}>View Analytics</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.item, styles.itemDanger]}
              onPress={() => { onSelect?.("delete"); onClose(); }}
            >
              <Text style={styles.itemTextDanger}>Delete Group</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.item}
              onPress={() => { onSelect?.("exit"); onClose(); }}
            >
              <Text style={styles.itemTextDanger}>Exit Group</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "transparent",
  },
  backdropTouch: {
    flex: 1,
  },
  dropdown: {
    position: "absolute",
    width: DROPDOWN_WIDTH,
    backgroundColor: "#222327",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#33353b",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 20,
  },
  arrow: {
    position: "absolute",
    top: -8,
    right: 14,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#222327",
  },
  menu: {
    paddingTop: 6,
  },
  item: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2b30",
  },
  itemDanger: {
    borderBottomWidth: 0,
  },
  itemText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "500",
  },
  itemTextDanger: {
    color: "#ff6b6b",
    fontSize: 15,
    fontWeight: "500",
  },
});
