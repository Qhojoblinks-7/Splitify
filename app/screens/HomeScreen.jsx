import {View, Text, StyleSheet, Image, Pressable, ScrollView} from 'react-native';
import{useSafeAreaInsets} from 'react-native-safe-area-context';
import BaseButton from '../../components/atoms/BaseButton';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {Send, Download, Upload, Clock, Bell, LogOut} from 'lucide-react-native';
import ActivityCard from '../../components/molecule/ActivityCard';
import BottomSheet from '../../components/molecule/BottomSheet';
import { useTabBarStore } from '../../store/tabBar';

export default function HomeScreen (){
    const insets = useSafeAreaInsets();
  const router = useRouter();
  const [isSheetVisible, setSheetVisible] = useState(false);
  const [isPaymentVisible, setPaymentVisible] = useState(false);
  const [activities, setActivities] = useState([
      { id: '1', title: 'Dinner at Restaurant', amount: '45.00 GHC', receipientName: 'John Doe', receipientEmail: 'john.doe@example.com', initialStatus: 'pay' },
      { id: '2', title: 'Salary for June', amount: '1500.00 GHC', senderName: 'Jane Smith', initialStatus: 'request' },
      { id: '3', title: 'Grocery Shopping', amount: '120.50 GHC', receipientName: 'Alex Johnson', receipientEmail: 'alex.johnson@example.com', initialStatus: 'paid' },
      { id: '4', title: 'Freelance Project', amount: '600.00 GHC', senderName: 'Emily Davis', initialStatus: 'request' },
      { id: '5', title: 'Movie Night', amount: '35.00 GHC', receipientName: 'Kofi Mensah', receipientEmail: 'kofi.mensah@example.com', initialStatus: 'paid' },
      { id: '6', title: 'Internet Bundle', amount: '150.00 GHC', receipientName: 'MTN Ghana', receipientEmail: 'support@mtnghana.com', initialStatus: 'paid' },
  ]);
  const [paymentCard, setPaymentCard] = useState(null);
  const { setMode, setCustomButtons } = useTabBarStore();

    const onPressSendMoney = () => router.push('/SendMoney');
    const onPressRequestMoney = () => router.push('/RequestMoney');
    const onPressTopUp = () => router.push('/TopUp');
    const onPressWithdraw = () => router.push('/Withdraw');
    const onPressHistory = () => router.push('/History');
    const onPressActivity = () => router.push('/Activity');
    const onPressNotifications = () => setSheetVisible(true);

    const handlePayPress = (card) => {
        setPaymentCard(card);
        setPaymentVisible(true);
        setMode('custom');
        setCustomButtons([
            { label: 'Cancel', variant: 'cancel', onPress: () => { setPaymentVisible(false); setPaymentCard(null); setMode('tabs'); setCustomButtons([]); } },
            { label: 'Pay Now', variant: 'primary', onPress: () => {
                setActivities(prev => prev.map(a => a.id === card.id ? { ...a, initialStatus: 'paid' } : a));
                setPaymentVisible(false);
                setPaymentCard(null);
                setMode('tabs');
                setCustomButtons([]);
            } },
        ]);
    };

    const handlePaymentClose = () => {
        setPaymentVisible(false);
        setPaymentCard(null);
        setMode('tabs');
        setCustomButtons([]);
    };

    return(
        // CHANGED: Outer wrapper is now a static View so the top section stays fixed
        <View style={[styles.Container]}>
            
            {/* FIXED TOP SECTION */}
            <View style={styles.top}>
                <View style={styles.header}>
                    <Image
                        source={require('../../assets/images/logo2.png')}
                        style={styles.logoImage}
                        resizeMode="contain"
                    />
                    <Bell size={24} color="#797777" style={styles.notificationIcon} onPress={onPressNotifications} />
                </View>

                <View style={styles.balanceContainer}>
                    <View style={styles.balanceWrapper}>
                        <Text style={styles.balanceAmount}>1,250.00</Text>
                        <Text style={styles.balanceCurrency}>GHC</Text>
                    </View>
                    <Text style={styles.balanceLabel}>Current Balance</Text>
                </View>

                {/* COIN BUTTON GROUP */}
                <View style={styles.buttonGroup}>
                    {/* Send Coin */}
                    <View style={styles.actionColumn}>
                        <Pressable 
                            onPress={onPressSendMoney}
                            style={({ pressed }) => [
                                styles.coinCircle,
                                pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] }
                            ]}
                        >
                            <Send width={20} height={20} color="#ffffff" />
                        </Pressable>
                        <Text style={styles.actionLabel}>Send</Text>
                    </View>

                    {/* Request Coin */}
                    <View style={styles.actionColumn}>
                        <Pressable 
                            onPress={onPressRequestMoney}
                            style={({ pressed }) => [
                                styles.coinCircle,
                                pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] }
                            ]}
                        >
                            <Download width={20} height={20} color="#ffffff" />
                        </Pressable>
                        <Text style={styles.actionLabel}>Request</Text>
                    </View>

                    {/* Top Up Coin */}
                    <View style={styles.actionColumn}>
                        <Pressable 
                            onPress={onPressTopUp}
                            style={({ pressed }) => [
                                styles.coinCircle,
                                pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] }
                            ]}
                        >
                            <Upload width={20} height={20} color="#ffffff" />
                        </Pressable>
                        <Text style={styles.actionLabel}>Top</Text>
                    </View>

                    {/* Withdraw Coin */}
                    <View style={styles.actionColumn}>
                        <Pressable 
                            onPress={onPressWithdraw}
                            style={({ pressed }) => [
                                styles.coinCircle,
                                pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] }
                            ]}
                        >
                            <LogOut width={20} height={20} color="#ffffff" />
                        </Pressable>
                        <Text style={styles.actionLabel}>Withdraw</Text>
                    </View>

                    {/* History Coin */}
                    <View style={styles.actionColumn}>
                        <Pressable 
                            onPress={onPressHistory}
                            style={({ pressed }) => [
                                styles.coinCircle,
                                pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] }
                            ]}
                        >
                            <Clock width={20} height={20} color="#ffffff" />
                        </Pressable>
                        <Text style={styles.actionLabel}>History</Text>
                    </View>
                </View>
            </View>

            {/* SCROLLABLE ACTIVITY SECTION */}
            <View style={styles.activityContainer}>
                <View style={styles.activityHeader}>
                    <Text style={styles.activityTitle}>Activity</Text>
                    <Pressable onPress={onPressActivity}>
                        <Text style={styles.viewAll}>View All</Text>
                    </Pressable>
                </View>

                {/* CHANGED: Wrapped only the list inside a ScrollView */}
                <ScrollView 
                    style={styles.activityList} 
                    showsVerticalScrollIndicator={false}
                >
                    {activities.map(item => (
                        <ActivityCard
                            key={item.id}
                            title={item.title}
                            amount={item.amount}
                            receipientName={item.receipientName}
                            receipientEmail={item.receipientEmail}
                            senderName={item.senderName}
                            initialStatus={item.initialStatus}
                            onPayPress={handlePayPress}
                        />
                    ))}
                    
                    {/* Safe clear padding at the bottom inside the scroll viewport */}
                    <View style={{ height: 20 }} />
                </ScrollView>
            </View>

            {paymentCard && (
                <BottomSheet
                    isVisible={isPaymentVisible}
                    onClose={handlePaymentClose}
                    title="Pay"
                >
                    <View style={styles.paymentSheetContent}>
                        <View style={styles.divider} />

                        <Text style={styles.paymentLabel}>Amount</Text>
                        <Text style={styles.paymentAmount}>{paymentCard.amount}</Text>

                        <View style={styles.payToRow}>
                            <Text style={styles.payToLabel}>Pay to</Text>
                            <View style={styles.payToLine} />
                        </View>

                        <View style={styles.receiverRow}>
                            <View style={styles.receiverAvatar}>
                                <Text style={styles.receiverAvatarText}>
                                    {(paymentCard.receipientName || 'R').charAt(0)}
                                </Text>
                            </View>
                            <View style={styles.receiverInfo}>
                                <Text style={styles.receiverName}>{paymentCard.receipientName || 'Receiver'}</Text>
                                <Text style={styles.receiverEmail}>{paymentCard.receipientEmail || 'receiver@example.com'}</Text>
                            </View>
                        </View>

                        <View style={styles.divider} />
                    </View>
                </BottomSheet>
            )}

            <BottomSheet
              isVisible={isSheetVisible}
              onClose={() => setSheetVisible(false)}
              title="Quick Action"
            >
              <Text style={styles.sheetContentText}>Quick action content</Text>
            </BottomSheet>
        </View>
    );
      }

const styles = StyleSheet.create({
    Container: {
        flex: 1,
        backgroundColor: '#16171b', 
    },
    top: {
        paddingHorizontal: 20,
        alignItems: 'center',
        width: '100%',
        backgroundColor: '#fbb81c',
        paddingBottom: 28, 
    },
    spacer: {
        flex: 1,
    },
    footer: {
        width: '100%',
        alignItems: 'center',
    },
    header: {
       width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    logoImage: {
        width: 160, 
        height: 120,
        marginLeft: -40
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#ffffff',
        flex: 1,
        marginLeft: 12,
    },
    notificationIcon: {
        padding: 4,
    },
    balanceContainer: {
        marginBottom: 24,
        alignItems: 'center',
    },
    balanceWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    balanceAmount: {
        fontSize: 52,
        fontWeight: 'bold',
        color: '#666666',
    },
    balanceCurrency: {
        fontSize: 18,
        color: '#666666',
        marginLeft: 5,
        marginBottom: 4,
    },
    balanceLabel: {
        fontSize: 14,
        color: '#666666',
        marginTop: 4,
    },
    buttonGroup: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    actionColumn: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    coinCircle: {
        width: 56,                  
        height: 56,                 
        borderRadius: 28,           
        backgroundColor: '#16171b', 
        borderWidth: 2,
        borderColor: '#2a2b30',     
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',         
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 6,
    },
    actionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#181717',           
        marginTop: 8,
    },
    activityContainer: {
        flex: 1,
        minHeight: 0,
        marginTop: 25,
        paddingHorizontal: 10,
        overflow: 'hidden',
    },
    activityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    activityTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    viewAll: {
        fontSize: 14,
        color: '#c2a989',
    },
    activityList: {
        flex: 1,
        minHeight: 0,
        width: '100%',
        overflow: 'hidden',
    },
    paymentSheetContent: {
        paddingHorizontal: 20,
        paddingBottom: 84,
    },
    divider: {
        height: 1,
        backgroundColor: '#33353b',
        marginVertical: 16,
    },
    paymentLabel: {
        color: '#8e8e93',
        fontSize: 14,
        fontWeight: '600',
    },
    paymentAmount: {
        color: '#ffffff',
        fontSize: 30,
        fontWeight: 'bold',
        marginVertical: 4,
    },
    payToRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 18,
    },
    payToLabel: {
        color: '#8e8e93',
        fontSize: 14,
        fontWeight: '600',
        marginRight: 10,
    },
    payToLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#33353b',
    },
    receiverRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
    },
    receiverAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#fbb81c',
        justifyContent: 'center',
        alignItems: 'center',
    },
    receiverAvatarText: {
        color: '#16171b',
        fontSize: 16,
        fontWeight: 'bold',
    },
    receiverInfo: {
        marginLeft: 14,
        flex: 1,
    },
    receiverName: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    receiverEmail: {
        color: '#8e8e93',
        fontSize: 13,
        marginTop: 3,
    },
    sheetContentText: {
        color: "#ffffff",
        fontSize: 16,
        textAlign: "center",
        marginTop: 20,
    },
});