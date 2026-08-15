import React from 'react';
import { G, Path } from 'react-native-svg';

import type { AnatomyPresentation, AnatomyResolvedView, GovernedMuscleId } from '@/lib/anatomy-system';

type MaskRegistry = Readonly<Record<GovernedMuscleId, readonly string[]>>;

// Paths use the native 418 × 941 master coordinate space. Bilateral regions
// remain distinct shapes so seams stay visible and highlights do not become
// large undifferentiated blobs.
const FRONT: MaskRegistry = {
  chest: [
    'M145 205 C165 186 195 185 226 204 L226 277 C198 289 169 279 145 261 C137 245 137 221 145 205 Z',
    'M234 204 C264 185 296 187 315 205 C323 222 323 245 315 261 C290 280 261 289 234 277 Z',
  ],
  front_delts: [
    'M112 205 C126 185 149 181 166 194 C151 211 143 238 142 269 C123 274 108 261 102 242 C100 227 104 214 112 205 Z',
    'M298 194 C317 181 341 186 354 207 C362 220 363 239 354 253 C347 266 336 273 321 269 C320 238 313 211 298 194 Z',
  ],
  side_delts: [
    'M102 210 C111 190 129 182 146 185 C132 205 124 235 124 263 C108 255 98 239 98 223 Z',
    'M315 185 C334 182 350 190 360 210 C367 226 360 251 338 263 C338 234 329 205 315 185 Z',
  ],
  rear_delts: [],
  lats: [],
  upper_back: [],
  traps: [
    'M187 169 C202 180 217 188 229 199 C211 196 191 191 170 185 Z',
    'M272 169 C256 180 243 188 232 199 C250 196 268 191 289 185 Z',
  ],
  biceps: [
    'M109 267 C125 249 141 260 145 286 C145 320 133 348 117 358 C103 344 100 315 104 289 Z',
    'M316 286 C319 260 337 249 351 268 L357 290 C361 316 355 345 342 358 C326 348 316 319 316 286 Z',
  ],
  triceps: [],
  forearms: [
    'M93 348 C107 337 122 354 125 383 L112 459 C108 477 96 488 86 477 C78 464 82 441 84 420 Z',
    'M336 383 C340 354 355 337 368 348 L379 420 C383 442 385 463 373 478 C362 488 350 476 347 458 Z',
  ],
  quads: [
    'M155 493 C179 477 204 494 208 533 L204 650 C199 676 181 689 164 673 C150 638 145 578 146 529 Z',
    'M251 493 C276 478 300 495 313 529 C314 578 308 638 295 673 C278 690 259 676 255 650 L251 533 Z',
  ],
  hamstrings: [],
  glutes: [],
  adductors: [
    'M209 493 C221 501 225 526 225 553 L220 644 C216 658 207 651 204 633 L205 532 Z',
    'M250 493 C239 501 234 526 234 553 L239 644 C242 658 251 651 256 633 L254 532 Z',
  ],
  abductors: [
    'M146 488 C163 470 183 465 201 482 L181 514 L151 553 C143 533 141 508 146 488 Z',
    'M313 488 C296 470 276 465 258 482 L278 514 L308 553 C316 533 318 508 313 488 Z',
  ],
  calves: [
    'M151 682 C170 666 191 680 194 720 L187 818 C180 838 164 836 153 818 C144 778 140 727 151 682 Z',
    'M265 720 C268 680 290 666 308 682 C319 727 315 778 306 818 C295 836 279 838 272 818 Z',
  ],
  abs: [
    'M196 281 C208 274 222 279 225 293 L223 326 C214 334 203 334 194 326 Z M193 333 C203 327 216 328 224 336 L222 370 C213 378 201 377 193 369 Z M192 377 C202 372 214 373 222 381 L219 421 C210 431 200 429 191 418 Z',
    'M235 293 C238 279 251 274 264 281 L266 326 C257 334 246 334 236 326 Z M236 336 C244 328 257 327 267 333 L267 369 C258 377 247 378 238 370 Z M238 381 C246 373 258 372 268 377 L269 418 C260 429 250 431 241 421 Z',
  ],
  obliques: [
    'M154 294 C170 281 188 292 191 318 L189 413 C181 444 169 457 158 441 C148 395 143 340 154 294 Z',
    'M269 318 C272 292 290 281 305 294 C317 340 311 395 302 441 C290 457 278 444 270 413 Z',
  ],
  lower_back: [],
  serratus: [
    'M145 275 C159 264 174 270 184 287 L176 323 L158 349 C148 328 143 302 145 275 Z',
    'M275 287 C285 270 300 264 314 275 C316 302 311 328 301 349 L283 323 Z',
  ],
  hip_flexors: [
    'M177 430 C194 417 209 429 213 455 L205 496 L182 515 C170 494 166 458 177 430 Z',
    'M247 455 C251 429 266 417 283 430 C294 458 289 494 278 515 L255 496 Z',
  ],
  neck: [
    'M191 146 C203 157 217 165 229 171 C213 184 201 187 190 181 Z',
    'M268 146 C257 157 243 165 231 171 C247 184 258 187 269 181 Z',
  ],
};

const REAR: MaskRegistry = {
  chest: [],
  front_delts: [],
  side_delts: [
    'M108 205 C121 185 141 181 159 194 C145 213 139 239 139 262 C119 268 104 252 99 231 Z',
    'M300 194 C318 181 339 185 352 205 C361 224 357 249 320 263 C320 239 314 213 300 194 Z',
  ],
  rear_delts: [
    'M116 207 C136 187 159 190 176 211 L158 260 C139 270 119 258 108 238 Z',
    'M283 211 C300 190 324 187 344 207 L352 238 C341 258 321 270 301 260 Z',
  ],
  lats: [
    'M143 271 C164 252 195 262 224 298 L218 398 L180 429 C154 404 139 350 143 271 Z',
    'M316 271 C295 252 265 262 235 298 L241 398 L279 429 C305 404 320 350 316 271 Z',
  ],
  upper_back: [
    'M176 208 C195 195 216 205 226 226 L224 301 C203 289 183 272 163 248 Z',
    'M283 208 C264 195 243 205 233 226 L235 301 C256 289 276 272 296 248 Z',
  ],
  traps: [
    'M181 158 C202 176 219 189 229 212 L225 291 C210 265 193 234 164 211 Z',
    'M278 158 C258 176 241 189 230 212 L234 291 C250 265 267 234 296 211 Z',
  ],
  biceps: [],
  triceps: [
    'M112 263 C126 245 146 254 150 284 C147 326 134 355 119 367 C105 350 101 312 106 284 Z',
    'M309 284 C313 254 333 245 347 263 L353 284 C358 312 354 350 340 367 C324 355 312 326 309 284 Z',
  ],
  forearms: [
    'M91 354 C105 341 120 359 123 389 L110 460 C106 480 94 489 84 477 C77 456 81 426 84 402 Z',
    'M336 389 C339 359 354 341 368 354 L375 402 C378 426 382 456 374 477 C365 489 353 480 349 460 Z',
  ],
  quads: [],
  hamstrings: [
    'M154 526 C173 502 202 505 214 535 L208 658 C199 684 178 691 160 669 C148 625 145 570 154 526 Z',
    'M245 535 C257 505 286 502 305 526 C314 570 311 625 299 669 C281 691 260 684 251 658 Z',
  ],
  glutes: [
    'M154 425 C174 405 209 409 226 438 L224 514 C203 535 172 533 153 510 C143 485 144 449 154 425 Z',
    'M305 425 C285 405 250 409 233 438 L235 514 C256 535 287 533 306 510 C316 485 315 449 305 425 Z',
  ],
  adductors: [],
  abductors: [
    'M147 438 C158 420 174 411 191 414 L171 478 C160 493 149 485 144 467 Z',
    'M312 438 C301 420 285 411 268 414 L288 478 C299 493 310 485 315 467 Z',
  ],
  calves: [
    'M146 678 C167 656 191 674 197 716 L188 807 C181 834 161 838 148 812 C137 770 136 718 146 678 Z',
    'M262 716 C268 674 292 656 313 678 C323 718 322 770 311 812 C298 838 278 834 271 807 Z',
  ],
  abs: [],
  obliques: [],
  lower_back: [
    'M181 376 C197 355 217 348 228 362 L226 430 C208 443 190 435 174 417 Z',
    'M278 376 C262 355 242 348 231 362 L233 430 C251 443 269 435 285 417 Z',
  ],
  serratus: [],
  hip_flexors: [],
  neck: [
    'M190 117 C203 108 218 113 228 129 L226 184 C210 180 198 170 188 157 Z',
    'M269 117 C256 108 241 113 231 129 L233 184 C249 180 261 170 271 157 Z',
  ],
};

export function AnatomyMaskPaths({
  muscle,
  presentation,
  view,
  fill,
  stroke,
  opacity,
}: {
  muscle: GovernedMuscleId;
  presentation: AnatomyPresentation;
  view: AnatomyResolvedView;
  fill: string;
  stroke: string;
  opacity: number;
}) {
  if (view === 'dual') return null;
  const paths = (view === 'front' ? FRONT : REAR)[muscle];
  if (!paths.length) return null;
  const transform = presentation === 'feminine'
    ? view === 'front'
      ? 'translate(30 0) scale(0.90 1)'
      : 'translate(6 0) scale(0.88 1)'
    : undefined;
  return (
    <G transform={transform}>
      {paths.map((path, index) => (
        <Path
          key={`${muscle}-${index}`}
          d={path}
          fill={fill}
          fillOpacity={opacity}
          stroke={stroke}
          strokeOpacity={Math.min(1, opacity + 0.16)}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
      ))}
    </G>
  );
}

export function mountedMasksForView(
  muscles: readonly GovernedMuscleId[],
  view: AnatomyResolvedView,
): GovernedMuscleId[] {
  if (view === 'dual') return muscles.filter((muscle) => FRONT[muscle].length || REAR[muscle].length);
  const registry = view === 'front' ? FRONT : REAR;
  return muscles.filter((muscle) => registry[muscle].length > 0);
}
