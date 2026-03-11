import { useEffect, useState } from 'react';
import { Camera, useCameraDevice } from 'react-native-vision-camera'
import { StyleSheet, View, Text } from 'react-native';

export default function App() {
    const device = useCameraDevice('front')
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);

    useEffect(() => {
        let isMounted = true;

        const checkPermission = async () => {
            const currentStatus = await Camera.getCameraPermissionStatus();
            if (currentStatus === 'granted') {
                if (isMounted) setHasPermission(true);
                return;
            }

            const newStatus = await Camera.requestCameraPermission();
            if (isMounted) setHasPermission(newStatus === 'granted');
        };

        checkPermission();
        return () => {
            isMounted = false;
        };
    }, []);

    if (hasPermission === null) {
        return (
            <View style={styles.container}>
                <Text>Checking camera permission...</Text>
            </View>
        );
    }

    if (!hasPermission) {
        return (
            <View style={styles.container}>
                <Text>Camera permission denied. Please enable it in settings.</Text>
            </View>
        );
    }

    if (device == null) {
        return (
            <View style={styles.container}>
                <Text>Loading camera...</Text>
            </View>
        );
    }

    return (
        <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
        />
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});