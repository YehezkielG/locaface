import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

  export const pickImage = async (useCamera: boolean, setAvatarUrl: (uri: string) => void) => {
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Izin Ditolak', 'Butuh akses kamera untuk mengambil foto profil.');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Izin Ditolak', 'Butuh akses galeri untuk memilih foto profil.');
          return;
        }
      }

      const result = await (useCamera
        ? ImagePicker.launchCameraAsync({
            cameraType: ImagePicker.CameraType.front, 
            allowsEditing: true, 
            aspect: [1, 1],
            quality: 0.5, 
          })
        : ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, 
            aspect: [1, 1],
            quality: 0.5,
          }));

      if (!result.canceled) {
         setAvatarUrl(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Gagal memuat gambar:", error);
      Alert.alert('Error', 'Terjadi kesalahan saat memuat gambar.');
    }
  };

  export const handleAvatarPress = (setAvatarUrl: (uri: string) => void) => {
    Alert.alert(
      'Ubah Foto Profil',
      'Pilih sumber foto yang ingin kamu gunakan',
      [
        { text: 'Buka Kamera', onPress: () => pickImage(true, setAvatarUrl) },
        { text: 'Pilih dari Galeri', onPress: () => pickImage(false, setAvatarUrl) },
        { text: 'Batal', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };