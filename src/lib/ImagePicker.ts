import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { showPopup } from '@/src/lib/inAppPopup';

  export const pickImage = async (useCamera: boolean, setAvatarUrl: (uri: string) => void) => {
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          showPopup({ title: 'Permission Denied', message: 'Camera access is required to take a profile photo.', type: 'warning' });
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showPopup({ title: 'Permission Denied', message: 'Gallery access is required to choose a profile photo.', type: 'warning' });
          return;
        }
      }

      const result = await (useCamera
        ? ImagePicker.launchCameraAsync({
            cameraType: ImagePicker.CameraType.front, 
            allowsEditing: true, 
            aspect: [1, 1],
            quality: 0.6,
          })
        : ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, 
            aspect: [1, 1],
            quality: 0.6,
          }));

      if (!result.canceled) {
         setAvatarUrl(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Failed to load image:", error);
      showPopup({ title: 'Error', message: 'An error occurred while loading the image.', type: 'error' });
    }
  };

  export const handleAvatarPress = (setAvatarUrl: (uri: string) => void) => {
    Alert.alert(
      'Change Profile Photo',
      'Choose the photo source you want to use',
      [
        { text: 'Open Camera', onPress: () => pickImage(true, setAvatarUrl) },
        { text: 'Choose from Gallery', onPress: () => pickImage(false, setAvatarUrl) },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };