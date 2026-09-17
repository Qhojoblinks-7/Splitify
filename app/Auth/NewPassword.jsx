import {View, Text, StyleSheet} from 'react-native';
import CustomInput from '../../components/atoms/CustomInput';
import BaseButton from '../../components/atoms/BaseButton';
import {Lock} from 'lucide-react-native';
import { useRouter } from 'expo-router';


export default function NewPassword (){
    const router = useRouter();

    const onPressContinue = () => {
        router.push('/HomeScreen');
    }

    return(
        <View style={styles.Container}>

            <View style={styles.top}>
                <Text style={styles.title}>Create new password</Text>

                <CustomInput
                    label='New Password'
                    iconLeft={<Lock size={20} color='#797777'/>}
                    iconRight
                    secureTextEntry
                    borderColor='#797777'
                    />

                    <CustomInput
                        label='Confirm New Password'
                        iconLeft={<Lock size={20} color='#797777'/>}
                        iconRight
                        secureTextEntry
                        borderColor="#797777"
                    />
            </View>

            <View style={styles.spacer} />

            <View style={styles.footer}>
                <BaseButton
                    title="Continue"
                    variant = "primary"
                    fullWidth
                    onPress = {onPressContinue}
                />

            </View>
        </View>
    )
};

const styles = StyleSheet.create({
    Container: {
        flex: 1,
        backgroundColor: '#16171b', 
        paddingHorizontal: 20,
        paddingTop: 60,    
        paddingBottom: 24, 
    },
    top: {
        width: '100%',
        alignItems: 'flex-start', // Shifted headings to the left edge for clean readability
    },
    spacer: {
        flex: 1, 
    },
    footer: {
        width: '100%',
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 10,
    },
});