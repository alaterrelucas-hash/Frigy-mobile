import { View, Text, TouchableOpacity } from 'react-native';
import { Refrigerator, Snowflake, Package } from 'lucide-react-native';

const SCOPES = [
  { id: 'Frigo', label: 'Frigo', Icon: Refrigerator },
  { id: 'Congélateur', label: 'Congélateur', Icon: Snowflake },
  { id: 'Placard', label: 'Placard', Icon: Package },
];

// Segmented control à sélection unique — remplace les 3 cartes cliquables
// indépendantes de l'ancienne UI (qui pouvaient toutes rester ouvertes en même temps).
export default function StorageScopeControl({ active, onChange, theme, fonts }) {
  return (
    <View style={{
      flexDirection: 'row', backgroundColor: theme.scopeContainerBg,
      borderRadius: 15, padding: 4, gap: 3,
    }}>
      {SCOPES.map(s => {
        const isActive = active === s.id;
        return (
          <TouchableOpacity
            key={s.id}
            onPress={() => onChange(s.id)}
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 6, paddingVertical: 13, borderRadius: 12,
              backgroundColor: isActive ? theme.scopeActiveBg : 'transparent',
            }}>
            <s.Icon size={16} color={isActive ? theme.scopeActiveIcon : theme.scopeInactiveText} strokeWidth={isActive ? 2 : 1.8} />
            {/* Label — Typography System Frigy (600 actif / 400 inactif) */}
            <Text style={{
              fontFamily: isActive ? fonts.semibold : fonts.regular,
              fontSize: 15, fontWeight: isActive ? '600' : '400',
              color: isActive ? theme.scopeActiveText : theme.scopeInactiveText,
            }}>
              {s.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
