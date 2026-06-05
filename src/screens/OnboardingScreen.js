import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Scan, CalendarClock, Sparkles } from 'lucide-react-native';
import { C } from '../config/constants';

const { width } = Dimensions.get('window');

const SLIDES = [
  { id: '1' },
  { id: '2' },
  { id: '3' },
];

function Slide1() {
  return (
    <View style={{ width, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
      <Image
        source={require('../../assets/fridge.png')}
        style={{ width: 220, height: 260, marginBottom: 32 }}
        resizeMode="contain"
      />
      <Text style={{ fontSize: 17, color: '#6B7280', textAlign: 'center', lineHeight: 26 }}>
        Ton assistant anti-gaspillage.{'\n'}Scanne, suis, cuisine — sans rien jeter.
      </Text>
    </View>
  );
}

function Slide2() {
  const features = [
    {
      Icon: Scan,
      color: C.green,
      title: 'Scanne en 3 secondes',
      desc: 'Code-barres, ticket de caisse ou photo — tous tes produits ajoutés en un geste.',
    },
    {
      Icon: CalendarClock,
      color: '#F59E0B',
      title: 'Zéro produit gaspillé',
      desc: 'Alertes DLC avant expiration, tri par urgence, rien ne passe inaperçu.',
    },
    {
      Icon: Sparkles,
      color: '#8B5CF6',
      title: 'Recettes sur mesure',
      desc: 'Frigy suggère des recettes avec ce que tu as déjà — anti-gaspi et délicieux.',
    },
  ];

  return (
    <View style={{ width, flex: 1, justifyContent: 'center', paddingHorizontal: 28 }}>
      <Text style={{ fontSize: 30, fontWeight: '900', color: C.t1, letterSpacing: -1, marginBottom: 32, textAlign: 'center' }}>
        Tout ce dont{'\n'}tu as besoin
      </Text>
      {features.map(({ Icon, color, title, desc }, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24, gap: 16 }}>
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: color + '18',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={22} color={color} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.t1, marginBottom: 3 }}>{title}</Text>
            <Text style={{ fontSize: 13, color: '#6B7280', lineHeight: 20 }}>{desc}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function Slide3({ onStart }) {
  return (
    <View style={{ width, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
      <Image
        source={require('../../assets/planet.png')}
        style={{ width: 140, height: 140, marginBottom: 32 }}
        resizeMode="contain"
      />
      <Text style={{ fontSize: 30, fontWeight: '900', color: C.t1, letterSpacing: -1, textAlign: 'center', marginBottom: 12 }}>
        Prêt à réduire{'\n'}ton impact ?
      </Text>
      <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 24, marginBottom: 40 }}>
        En France, une famille jette en moyenne{' '}
        <Text style={{ fontWeight: '800', color: C.t1 }}>400 € de nourriture par an.</Text>
        {'\n'}Frigy te remet cet argent dans la poche.
      </Text>
      <TouchableOpacity
        onPress={onStart}
        style={{ backgroundColor: C.green, paddingVertical: 16, paddingHorizontal: 48,
          borderRadius: 16, width: '100%', alignItems: 'center',
          shadowColor: C.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12 }}>
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 }}>
          Commencer gratuitement
        </Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 12 }}>
        Essai Pro gratuit 7 jours · Sans engagement
      </Text>
    </View>
  );
}

export default function OnboardingScreen({ onDone }) {
  const [index, setIndex] = useState(0);
  const listRef = useRef(null);

  const goNext = () => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      onDone();
    }
  };

  const renderSlide = ({ item }) => {
    if (item.id === '1') return <Slide1 />;
    if (item.id === '2') return <Slide2 />;
    return <Slide3 onStart={onDone} />;
  };

  const isLast = index === SLIDES.length - 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF8' }}>
      {/* Passer button */}
      {!isLast && (
        <TouchableOpacity
          onPress={onDone}
          style={{ position: 'absolute', top: 56, right: 20, zIndex: 10,
            paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#F3F4F6', borderRadius: 100 }}>
          <Text style={{ fontSize: 13, color: '#6B7280', fontWeight: '600' }}>Passer</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={!isLast}
        onMomentumScrollEnd={e => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex(newIndex);
        }}
        style={{ flex: 1 }}
      />

      {/* Dots + Next button */}
      <View style={{ paddingHorizontal: 28, paddingBottom: 32, paddingTop: 16 }}>
        {/* Dots */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
          {SLIDES.map((_, i) => (
            <View key={i} style={{
              height: 6, borderRadius: 3,
              width: i === index ? 24 : 6,
              backgroundColor: i === index ? C.green : '#D1D5DB',
            }} />
          ))}
        </View>

        {/* Next button — masqué sur le slide 3 (le bouton est dans le slide lui-même) */}
        {!isLast && (
          <TouchableOpacity
            onPress={goNext}
            style={{ backgroundColor: C.t1, paddingVertical: 15, borderRadius: 14, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Suivant →</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}
