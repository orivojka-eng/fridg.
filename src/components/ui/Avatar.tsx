import React from 'react';
import { Image, View, StyleSheet, ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

/** The six illustrated avatars from design folder → "avatars for the app". */
export const AVATARS: ImageSourcePropType[] = [
  require('../../../assets/avatars/avatar-1.png'),
  require('../../../assets/avatars/avatar-2.png'),
  require('../../../assets/avatars/avatar-3.png'),
  require('../../../assets/avatars/avatar-4.png'),
  require('../../../assets/avatars/avatar-5.png'),
  require('../../../assets/avatars/avatar-6.png'),
];

/** Stable avatar for a creator name so the same author always gets the same face. */
export const avatarIndexFor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % AVATARS.length;
};

interface Props {
  /** Explicit avatar index (0-5); wins over `name`. */
  index?: number;
  /** Used to pick a stable avatar when no index is given. */
  name?: string;
  size?: number;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Avatar: React.FC<Props> = ({ index, name, size = 40, selected, style }) => {
  const t = useTheme();
  const idx = index ?? (name ? avatarIndexFor(name) : 0);
  const source = AVATARS[((idx % AVATARS.length) + AVATARS.length) % AVATARS.length];
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: selected ? 3 : 0,
          borderColor: t.lime,
          backgroundColor: t.cream,
        },
        style,
      ]}
    >
      <Image source={source} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
});
