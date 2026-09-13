import {View, Pressable, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SquareExclamationPoint, Settings } from 'lucide-react-native';

/**
 * Notifications.jsx
 * 
 * This component displays a list of notifications for the user.
 * Each notification can be dismissed by swipping left on the item.
 * 
 * The notifications are currently hardcoded for demonstration purposes.
 * In a real application, they would likely be fetched from an API or state management store.
 */

export default function () {
    const inserts = useSafeAreaInsets();
    const router = useRouter();

    const onPressSettings = () => {
        router.push('/Settings');
    };


    return(
        <View style={[styles.container, { paddingTop: inserts.top }]}>
            <View style={styles.header}>
                <Text style={styles.headerText} size={24}>Notifications</Text>
                <Settings style={styles.settingsIcon} 
                onPress={onPressSettings}/>
            </View>
            <ScrollView style={styles.notificationsList}>
                <View stlye={styles.timeFrame}>
                    <View style={styles.notificationItem}>
                    <View style={styles.notificationsTimeFrame}/>
                    <Text style={styles.notificationsTimeFrameText}>Today</Text>
                    <View stlye={{height: StyleSheet.hairlineWidth, backgroundColor: '#2a2b30'}}/>
                    <SquareExclamationPoint size={24} color="#fbb81c" />
                    <View style={styles.notificationItemTextContainer}>
                        <Text style={styles.notificationItemTitle}>New Feature Available!</Text>
                        <Text style={styles.notificationItemDescription}>Check out the new Splitify feature that allows you to split bills with friends more easily.</Text>
                    </View>
                </View>
                </View>
            </ScrollView>
        </View>
    )
}

const styles=StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#16171b',
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerText: {
        color: '#fbb81c',
        fontSize: 24,
        fontWeight: 'bold',
    },
    settingsIcon: {
        color: '#fbb81c',
    },
    notificationsList: {
        flex: 1,
    },
    notificationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e1f25',
        padding: 16,
        borderRadius: 8,
        marginBottom: 16,
    },
    notificationItemTextContainer: {
        marginLeft: 16,
    },
    notificationItemTitle: {
        color: '#fbb81c',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    notificationItemDescription: {
        color: '#ffffff',
        fontSize: 14,
    },
    notificationsTimeFrame:{
        color: "#fff",
        flex: 1

    }
})