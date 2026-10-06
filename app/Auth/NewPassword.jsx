import {View, Text, StyleSheet} from 'react-native';
import CustomInput from '../../components/atoms/CustomInput';
import BaseButton from '../../components/atoms/BaseButton';
import {Lock} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AuthScreenLayout from '../../components/molecule/AuthScreenLayout';
import colors from "../../theme/colors";

export default function NewPassword (){
    const router = useRouter();

    const onPressContinue = () => {
        router.replace('/(tabs)');
    }

    return(
        <AuthScreenLayout
          title="Create new password"
          footer={<BaseButton title="Continue" variant = "primary" fullWidth onPress = {onPressContinue} />}
        >
            <CustomInput
                label='New Password'
                iconLeft={<Lock size={20} color={colors.inactive}/>}
                iconRight
                secureTextEntry
                borderColor={colors.inactive}
                />

                <CustomInput
                    label='Confirm New Password'
                    iconLeft={<Lock size={20} color={colors.inactive}/>}
                    iconRight
                    secureTextEntry
                    borderColor={colors.inactive}
                />
        </AuthScreenLayout>
    )
};
