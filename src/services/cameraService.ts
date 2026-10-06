import { Camera } from 'expo-camera';

export const requestCameraPermission = async (): Promise<boolean> => {
  try {
    const { status } = await Camera.requestCameraPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.warn('Camera permission error:', error);
    return false;
  }
};

export const scanFridgeItems = async (imageUri: string) => {
  // Simulates AI vision detection endpoint call to backend
  return [
    { name: 'Fresh Avocado', category: 'Produce', confidence: 0.96 },
    { name: 'Greek Yogurt', category: 'Dairy', confidence: 0.92 },
    { name: 'Sourdough Bread', category: 'Pantry', confidence: 0.88 },
  ];
};
