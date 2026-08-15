import { Image } from 'react-native';

// Trace organique (Spatial Language) — UNE seule flèche reliant le Gathering au bloc
// Transformation. Asset fourni par le design (assets/home-results/arrow-organic.png,
// détouré transparent) plutôt qu'un SVG dessiné. Taille 30px ; opacité relevée pour plus
// de présence (image raster → on ne peut pas épaissir le trait au rendu). Décorative
// (pointerEvents='none' côté parent), jamais navigation. Pas de tint : on préserve le trait.
export default function OrganicArrow({ width = 56 }) {
  return (
    <Image
      source={require('../../../assets/home-results/arrow-organic.png')}
      style={{ width, height: width, opacity: 1 }} // asset carré 100×100
      resizeMode="contain"
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
