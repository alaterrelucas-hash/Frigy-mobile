import { Dimensions } from 'react-native';
import { Refrigerator, Snowflake, Package } from 'lucide-react-native';

export const SCREEN_W = Dimensions.get('window').width;

export const C = {
  green: '#3DB33F', greenDk: '#2E8A30', mint: '#E8F5DC',
  yellow: '#FF9500', red: '#FF4B4B', orange: '#FF9500',
  bg: '#F7F7F0', card: '#FFFFFF',
  t1: '#1C1C1E', t2: '#3A3A3C', t3: '#8E8E93', t4: '#D1D1D6',
  border: '#F2F2F7',
};

export const urgBg = d => d <= 1 ? '#FF4B4B' : d <= 3 ? '#FF9500' : '#FFB800';
export const urgLbl = d => d <= 0 ? 'J-1' : `J-${d}`;

export const LOC_ITEMS = [
  { id: 'Frigo', Icon: Refrigerator },
  { id: 'Congélateur', Icon: Snowflake },
  { id: 'Placard', Icon: Package },
];
export const LOC_PAGES = LOC_ITEMS;
