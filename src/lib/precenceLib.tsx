import * as Location from 'expo-location';
import { signedPost } from '@/src/lib/securityServices';

export const calculateDistanceMeters = (
	fromLat: number,
	fromLng: number,
	toLat: number,
	toLng: number,
) => {
	const toRadians = (value: number) => (value * Math.PI) / 180;
	const earthRadiusMeters = 6_371_000;

	const deltaLat = toRadians(toLat - fromLat);
	const deltaLng = toRadians(toLng - fromLng);

	const lat1 = toRadians(fromLat);
	const lat2 = toRadians(toLat);

	const a =
		Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
		Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return earthRadiusMeters * c;
};

export const validateUserInClassRadius = async (
	classLatitude: number,
	classLongitude: number,
	maxRadiusMeters: number = 15,
) => {
	const { status } = await Location.requestForegroundPermissionsAsync();
	if (status !== 'granted') {
		return {
			ok: false,
			message: 'Location permission is required to start precence.',
			distanceMeters: null as number | null,
			userLatitude: null as number | null,
			userLongitude: null as number | null,
		};
	}

	const currentPosition = await Location.getCurrentPositionAsync({
		accuracy: Location.Accuracy.Highest,
	});

	const isMockedLocation =
		(currentPosition as any)?.mocked === true ||
		(currentPosition as any)?.coords?.mocked === true;

	if (isMockedLocation) {
		return {
			ok: false,
			message: 'Fake GPS detected. Disable mock location apps to continue precence.',
			distanceMeters: null as number | null,
			userLatitude: null as number | null,
			userLongitude: null as number | null,
		};
	}

	const userLatitude = currentPosition.coords.latitude;
	const userLongitude = currentPosition.coords.longitude;
	const distanceMeters = calculateDistanceMeters(
		userLatitude,
		userLongitude,
		classLatitude,
		classLongitude,
	);

	if (distanceMeters > maxRadiusMeters) {
		return {
			ok: false,
			message: `You are ${distanceMeters.toFixed(2)}m away from the class point. Maximum allowed is ${maxRadiusMeters}m.`,
			distanceMeters,
			userLatitude,
			userLongitude,
		};
	}

	return {
		ok: true,
		message: 'Location is valid.',
		distanceMeters,
		userLatitude,
		userLongitude,
	};
};

export const submitStartPrecence = async (
	accessToken: string,
	payload: {
		class_id: string;
		image: string;
		latitude: number;
		longitude: number;
		distance_meters: number;
	},
) => {
	return signedPost('/attendence', payload, accessToken);
};
