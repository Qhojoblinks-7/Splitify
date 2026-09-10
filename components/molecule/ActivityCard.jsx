import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

export default function ActivityCard({ 
    title,
    amount,          
    receipientName,  
    senderName,
    initialStatus    
}) {
    const [status, setStatus] = useState(initialStatus?.toLowerCase() || 'pay');

    const handleAction = () => {
        if (status === 'pay') {
            console.log('Processing payment...');
            setStatus('paid');
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
    }
});