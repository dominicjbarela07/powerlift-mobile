import { LinearGradient } from 'expo-linear-gradient';
import {
  Box,
  BoxShadow,
  Canvas,
  LinearGradient as SkiaLinearGradient,
  RoundedRect,
  rect,
  rrect,
  vec,
} from '@shopify/react-native-skia';
import React, { useState, type ReactNode } from 'react';
import {
  ImageBackground,
  ImageStyle,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  SLColors,
  SLElevation,
  SLShadows,
  SLLayout,
  SLMaterials,
  SLMetricTones,
  SLRadius,
  SLSpacing,
  SLStatusTones,
  type SLStatusTone,
} from '@/constants/theme';
import { Text } from './sl-text';
import { SLMotionPressable } from './sl-motion';

export type SLSurfaceLevel = 1 | 2 | 3;
export type SLLiftAccent = 'total' | 'squat' | 'bench' | 'deadlift';
export type SLMaterialQuality = 'minimal' | 'standard' | 'full';

type SLSurfaceProps = {
  children: ReactNode;
  level?: SLSurfaceLevel;
  interactive?: boolean;
  selected?: boolean;
  disabled?: boolean;
  semanticTone?: SLStatusTone;
  liftAccent?: SLLiftAccent;
  materialAccent?: string;
  media?: boolean;
  materialQuality?: SLMaterialQuality;
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

function surfaceStyle(
  level: SLSurfaceLevel,
  selected: boolean,
  disabled: boolean,
  semanticTone?: SLStatusTone,
  liftAccent?: SLLiftAccent,
): ViewStyle[] {
  const definition = SLElevation[level];
  const accent = liftAccent
    ? SLMetricTones[liftAccent].solid
    : semanticTone && semanticTone !== 'neutral'
      ? SLStatusTones[semanticTone].border
      : undefined;

  return [
    {
      backgroundColor: definition.backgroundColor,
      borderColor: selected || (semanticTone && semanticTone !== 'neutral')
        ? (accent ?? SLColors.borderFocus)
        : definition.borderColor,
      borderWidth: selected || (semanticTone && semanticTone !== 'neutral') ? 1 : definition.borderWidth,
      opacity: disabled ? 0.45 : 1,
    },
    selected ? SLShadows.level3 : definition.shadow,
  ];
}

export function SLWorkspaceBackground({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.workspace, style]} />;
}

export function SLMaterialOverlay({
  level = 2,
  accent,
  compact = false,
  pressed = false,
  quality = compact ? 'minimal' : 'standard',
  radius,
}: {
  level?: SLSurfaceLevel;
  accent?: string;
  compact?: boolean;
  pressed?: boolean;
  quality?: SLMaterialQuality;
  radius?: number;
}) {
  const material = SLMaterials[level];
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const resolvedRadius = radius ?? (compact ? SLRadius.sm : level === 3 ? SLRadius.focus : SLRadius.object);
  const useSkia = quality === 'full' && bounds.width > 0 && bounds.height > 0;
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBounds((current) => current.width === width && current.height === height ? current : { width, height });
  };

  return (
    <View onLayout={onLayout} pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {useSkia ? (
        <Canvas style={StyleSheet.absoluteFillObject}>
          <RoundedRect height={bounds.height} r={resolvedRadius} width={bounds.width} x={0} y={0}>
            <SkiaLinearGradient
              colors={[...material.face]}
              end={vec(bounds.width * 0.82, bounds.height)}
              positions={[...SLMaterials.faceLocations]}
              start={vec(bounds.width * 0.12, 0)}
            />
          </RoundedRect>
          {accent ? (
            <RoundedRect height={bounds.height} r={resolvedRadius} width={bounds.width} x={0} y={0}>
              <SkiaLinearGradient
                colors={[accent, SLMaterials.accentMiddle, SLMaterials.clear]}
                end={vec(bounds.width * 0.08, bounds.height)}
                positions={[...SLMaterials.accentLocations]}
                start={vec(bounds.width, 0)}
              />
            </RoundedRect>
          ) : null}
          <RoundedRect
            height={Math.max(0, bounds.height - 1)}
            r={Math.max(0, resolvedRadius - 0.5)}
            style="stroke"
            strokeWidth={1}
            width={Math.max(0, bounds.width - 1)}
            x={0.5}
            y={0.5}
          >
            <SkiaLinearGradient
              colors={[material.topEdge, material.sideEdge, material.lowerEdge]}
              end={vec(bounds.width, bounds.height)}
              positions={[...SLMaterials.faceLocations]}
              start={vec(0, 0)}
            />
          </RoundedRect>
          <Box
            box={rrect(rect(0.5, 0.5, Math.max(0, bounds.width - 1), Math.max(0, bounds.height - 1)), resolvedRadius, resolvedRadius)}
            color="rgba(0, 0, 0, 0)"
          >
            <BoxShadow blur={pressed ? 7 : 4} color={material.innerDark} dx={pressed ? 3 : 2} dy={pressed ? 4 : 3} inner />
            <BoxShadow blur={pressed ? 1 : 3} color={material.innerLight} dx={-1} dy={-1} inner />
          </Box>
          {pressed ? (
            <RoundedRect color={SLMaterials.pressedCompression} height={bounds.height} r={resolvedRadius} width={bounds.width} x={0} y={0} />
          ) : null}
        </Canvas>
      ) : (
        <>
          <LinearGradient
            colors={material.face}
            end={{ x: 0.82, y: 1 }}
            locations={SLMaterials.faceLocations}
            start={{ x: 0.12, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
          {accent ? (
            <LinearGradient
              colors={[accent, SLMaterials.accentMiddle, SLMaterials.clear]}
              end={{ x: 0.08, y: 1 }}
              locations={SLMaterials.accentLocations}
              start={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
          ) : null}
          <View style={[styles.materialTopEdge, { backgroundColor: material.topEdge }, compact && styles.compactTopEdge]} />
          <View style={[styles.materialSideEdge, { backgroundColor: material.sideEdge }]} />
          <View style={[styles.materialLowerEdge, { backgroundColor: material.lowerEdge }, compact && styles.compactLowerEdge]} />
          {pressed ? <View style={[StyleSheet.absoluteFillObject, styles.materialPressed]} /> : null}
        </>
      )}
    </View>
  );
}

export function SLSurface({
  children,
  level = 2,
  interactive = false,
  selected = false,
  disabled = false,
  semanticTone,
  liftAccent,
  materialAccent,
  media = false,
  materialQuality,
  onPress,
  accessibilityLabel,
  style,
  contentStyle,
}: SLSurfaceProps) {
  const content = (pressed = false) => (
    <>
      <SLMaterialOverlay
        accent={materialAccent ?? (liftAccent
          ? SLMetricTones[liftAccent].illumination
          : selected
            ? SLColors.illuminationAccent
            : semanticTone && semanticTone !== 'neutral'
              ? SLStatusTones[semanticTone].background
              : undefined)}
        level={level}
        pressed={pressed}
        quality={materialQuality ?? (level === 3 || selected || liftAccent ? 'full' : 'standard')}
      />
      <View style={[styles.surfaceContent, media && styles.mediaContent, contentStyle]}>{children}</View>
    </>
  );
  const resolvedSurface = surfaceStyle(level, selected, disabled, semanticTone, liftAccent);

  if (interactive || onPress) {
    return (
      <SLMotionPressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.surface,
          level === 3 ? styles.focusRadius : styles.objectRadius,
          resolvedSurface,
          pressed && { backgroundColor: SLElevation[level].pressedBackgroundColor },
          pressed && SLElevation[level].pressedShadow,
          style,
        ]}
      >
        {({ pressed }: { pressed: boolean }) => content(pressed)}
      </SLMotionPressable>
    );
  }

  return (
    <View style={[styles.surface, level === 3 ? styles.focusRadius : styles.objectRadius, resolvedSurface, style]}>
      {content()}
    </View>
  );
}

export function SLSection({
  children,
  title,
  action,
  compact = false,
  style,
}: {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, compact && styles.sectionCompact, style]}>
      {title || action ? (
        <View style={styles.sectionHeader}>
          {title ? <Text typographyRole="sectionTitle" style={styles.sectionTitle}>{title}</Text> : <View />}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function SLMediaStage({
  source,
  children,
  level = 2,
  scrim = false,
  style,
  imageStyle,
}: {
  source: ImageSourcePropType;
  children?: ReactNode;
  level?: 2 | 3;
  scrim?: boolean;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}) {
  const definition = SLElevation[level];
  return (
    <ImageBackground
      source={source}
      resizeMode="cover"
      imageStyle={[styles.mediaImage, imageStyle]}
      style={[
        styles.mediaStage,
        {
          backgroundColor: definition.backgroundColor,
          borderColor: definition.borderColor,
          borderWidth: definition.borderWidth,
        },
        definition.shadow,
        style,
      ]}
    >
      {scrim ? <View pointerEvents="none" style={styles.flatScrim} /> : null}
      <SLMaterialOverlay level={level} />
      {children}
    </ImageBackground>
  );
}

export function SLFloatingUtilityClearance({
  children,
  includeTabs = true,
  style,
}: {
  children: ReactNode;
  includeTabs?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { paddingBottom: includeTabs ? SLLayout.bottomTabClearance : SLLayout.floatingUtilityClearance },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  workspace: { backgroundColor: SLColors.canvas },
  surface: { overflow: 'hidden' },
  objectRadius: { borderRadius: SLRadius.object },
  focusRadius: { borderRadius: SLRadius.focus },
  surfaceContent: { padding: SLSpacing.lg },
  materialTopEdge: {
    height: StyleSheet.hairlineWidth,
    left: SLSpacing.sm,
    position: 'absolute',
    right: SLSpacing.sm,
    top: 0,
  },
  compactTopEdge: { left: SLSpacing.xs, right: SLSpacing.xs },
  materialSideEdge: {
    bottom: SLSpacing.sm,
    left: 0,
    position: 'absolute',
    top: SLSpacing.sm,
    width: StyleSheet.hairlineWidth,
  },
  materialLowerEdge: {
    bottom: 0,
    height: 8,
    left: 8,
    position: 'absolute',
    right: 8,
  },
  compactLowerEdge: { height: SLSpacing.xs, left: SLSpacing.xs, right: SLSpacing.xs },
  materialPressed: { backgroundColor: SLMaterials.pressedCompression },
  mediaContent: { padding: 0 },
  section: { gap: SLLayout.objectGap },
  sectionCompact: { gap: SLLayout.contentGap },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 28 },
  sectionTitle: { color: SLColors.textPrimary },
  mediaStage: { borderRadius: SLRadius.object, overflow: 'hidden' },
  mediaImage: { borderRadius: SLRadius.object },
  flatScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3, 5, 8, 0.48)' },
});
