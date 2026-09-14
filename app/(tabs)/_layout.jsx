import { Tabs } from "expo-router/js-tabs";
import { Home, User, UserGroup, ScanLine, Users} from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#fbb81c",
        tabBarInactiveTintColor: "#797777",
        tabBarStyle: {
          backgroundColor: "#16171b",
          borderTopWidth: 0,
          elevation: 0,
          height: 60,
          headerShown: false,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "bold",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
            headerShown: false,
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Home color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: "Groups",
          tabBarIcon: ({ color, size }) => (
            <UserGroup color={color} size={size} />
          ),
        }}
       />
       <Tabs.Screen 
        name="scan"
        options={{
          title: "Scan",
            tabBarIcon: ({ color, size }) => (
                <ScanLine color={color} size={size} />
            ),
        }}
      />
       <Tabs.Screen 
        name="contacts"
        options={{
          title: "Contacts",
            tabBarIcon: ({ color, size }) => (
                <Users color={color} size={size} />
            ),
        }}
       />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <User color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}