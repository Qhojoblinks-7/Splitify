import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import BottomSheet from './BottomSheet';
import { useTabBarStore } from '../../store/tabBar';

export default function ActivityCard({ 
    title,
    amount,          
    receipientName,
    receipientEmail,
    senderName,
    initialStatus    
}) {
    const [status, setStatus] = useState(initialStatus?.toLowerCase() || 'pay');
    const [isPaymentSheetVisible, setPaymentSheetVisible] = useState(false);
    const [notes, setNotes] = useState('');
    const { setMode, setCustomButtons } = useTabBarStore();

    useEffect(() => {
        return () => {
            setMode('tabs');
            setCustomButtons([]);
        };
    }, [setMode, setCustomButtons]);

    const receiverEmail = receipientEmail || 'receiver@example.com';
    const displayAmount = '00.00';

    const getReceiverInitials = () => {
        const nameParts = (receipientName || 'Receiver').trim().split(/\s+/);
        return `${nameParts[0]?.[0] || 'R'}${nameParts[1]?.[0] || ''}`.toUpperCase();
    };

    const closePaymentSheet = () => {
        setPaymentSheetVisible(false);
        setNotes('');
        setMode('tabs');
        setCustomButtons([]);
    };

    const submitPayment = () => {
        setStatus('paid');
        closePaymentSheet();
    };

    const openPaymentSheet = () => {
        setNotes('');
        setMode('custom');
        setCustomButtons([
            {
                label: 'Cancel',
                variant: 'cancel',
                onPress: closePaymentSheet,
            },
            {
                label: 'Pay Now',
                variant: 'primary',
                onPress: submitPayment,
            },
        ]);
        setPaymentSheetVisible(true);
    };

    const handleAction = () => {
        if (status === 'pay') {
            openPaymentSheet();
        } else if (status === 'request') {
            console.log('Sending reminder request notification...');
            setStatus('paid');
        }
    };

    const getSubtext = () => {
        switch (status) {
            case 'pay':
                return `You owe ${receipientName}`;
            case 'request':
                return `${senderName} owes you`;
            case 'paid':
                return initialStatus === 'pay' 
                    ? `You paid ${receipientName}` 
                    : `Settled with ${senderName}`;
            default:
                return '';
        }
    };

    const getButtonTitle = () => {
        switch (status) {
            case 'pay': return 'Pay';
            case 'request': return 'Remind';
            case 'paid': return 'Paid';
            default: return 'Action';
        }
    };

    const isPaid = status === 'paid';

    return (
        <>
        <View style={[styles.cardContainer, isPaid && styles.cardPaidAlpha]}>
            
            {/* Left Content Column */}
            <View style={styles.leftColumn}>
                <Text style={styles.activityTitle} numberOfLines={1}>
                    {title}
                </Text>
                <Text style={styles.relationshipSubtext} numberOfLines={1}>
                    {getSubtext()}
                </Text>
            </View>

            {/* Right Financial Row Box */}
            <View style={styles.rightRowContainer}>
                <Text style={[
                    styles.monetaryAmount,
                    status === 'pay' && styles.amountOwedText,
                    status === 'request' && styles.amountOwedToYouText,
                    status === 'paid' && styles.amountSettledText
                ]}>
                    {amount}
                </Text>

                {/* FIXED: Using direct Pressable component to prevent hidden/clipped contents */}
                <Pressable 
                    onPress={handleAction}
                    disabled={isPaid}
                    style={({ pressed }) => [
                        styles.miniButton,
                        isPaid ? styles.btnPaid : styles.btnActive,
                        pressed && !isPaid && { opacity: 0.8 }
                    ]}
                >
                    <Text style={[styles.miniButtonText, isPaid && styles.miniButtonTextPaid]}>
                        {getButtonTitle()}
                    </Text>
                </Pressable>
            </View>

        </View>

        <BottomSheet
            isVisible={isPaymentSheetVisible}
            onClose={closePaymentSheet}
            title="Pay"
        >
            <View style={styles.paymentSheetContent}>
                <View style={styles.divider} />

                <Text style={styles.paymentLabel}>Amount</Text>
                <Text style={styles.paymentAmount}>{displayAmount}</Text>

                <View style={styles.payToRow}>
                    <Text style={styles.payToLabel}>Pay to</Text>
                    <View style={styles.payToLine} />
                </View>

                <View style={styles.receiverRow}>
                    <View style={styles.receiverAvatar}>
                        <Text style={styles.receiverAvatarText}>{getReceiverInitials()}</Text>
                    </View>
                    <View style={styles.receiverInfo}>
                        <Text style={styles.receiverName}>{receipientName || 'Receiver'}</Text>
                        <Text style={styles.receiverEmail}>{receiverEmail}</Text>
                    </View>
                </View>

                <View style={styles.divider} />

                <Text style={styles.notesLabel}>Notes (optional)</Text>
                <TextInput
                    style={styles.notesInput}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Add a note"
                    placeholderTextColor="#6f7076"
                    multiline
                    textAlignVertical="top"
                />
            </View>
        </BottomSheet>
        </>
    );
}

const styles = StyleSheet.create({
    cardContainer: {
        width: '100%',
        backgroundColor: '#222327', 
        borderRadius: 12,
        paddingHorizontal: 12,        
        paddingVertical: 14,          // Slight vertical padding boost keeps layouts crisp
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#33353b',
    },
    cardPaidAlpha: {
        opacity: 0.6, 
    },
    leftColumn: {
        flex: 1,
        paddingRight: 10,
    },
    activityTitle: {
        fontSize: 18,                 // Perfectly proportioned title sizing
        fontWeight: '600',
        color: '#ffffff',
        marginBottom: 4,
    },
    relationshipSubtext: {
        fontSize: 15,                 
        color: '#8e8e93',             // Slightly lighter gray reads cleaner over dark templates
    },
    rightRowContainer: {
        flexDirection: 'row',          
        alignItems: 'center',          
        gap: 10,                       // Unified structural spacing boundary
    },
    monetaryAmount: {
        fontSize: 14,                 
        fontWeight: '700',
    },
    amountOwedText: {
        color: '#ff6b6b', 
    },
    amountOwedToYouText: {
        color: '#fbb81c', 
    },
    amountSettledText: {
        color: '#8e8e93', 
    },
    // 🔥 NEW NATIVE FIXED MINI BUTTON UTILITIES
    miniButton: {
        height: 26,
        paddingHorizontal: 10,        // Uses text-based padding instead of static breaking widths
        borderRadius: 13,             // Half of height = perfect pill design
        justifyContent: 'center',     // Centers text cleanly vertically
        alignItems: 'center',         // Centers text cleanly horizontally
        minWidth: 54,                 // Guarantees small footprint scale baseline
    },
    btnActive: {
        backgroundColor: '#fbb81c',
    },
    btnPaid: {
        backgroundColor: '#2a2b30',
        borderWidth: 1,
        borderColor: '#33353b',
    },
    miniButtonText: {
        fontSize: 11,                 // Micro font scaling guarantees safe display inside 26px containers
        fontWeight: '700',
        color: '#16171b',             // Dark text over gold active layouts
    },
    miniButtonTextPaid: {
        color: '#8e8e93',             // Muted text over disabled layout elements
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
    notesLabel: {
        color: '#8e8e93',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    notesInput: {
        minHeight: 96,
        borderWidth: 1,
        borderColor: '#33353b',
        borderRadius: 12,
        backgroundColor: '#222327',
        color: '#ffffff',
        fontSize: 14,
        padding: 12,
        textAlignVertical: 'top',
    },
});