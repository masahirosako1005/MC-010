# 画像素材と生成記録

## スマホ用マップ背景（2026-11-10）

`public/assets/trip-overview-map-mobile-v1.webp` は既存の横長マップ背景を参照し、内蔵imagegen標準モードで縦長3:5へ再構成した同梱イラスト。960×1601、WebP quality 88、635,850 bytes。生成画像の構図・文字なし・画面全体を埋める風景は目視した。Sharpで配信用WebPへ変換し、元PNGは既定生成先に保持した。820px以下のマップで使用し、横長画像を縦長領域へcontainしていた上下余白をなくす。文字・ピン・点線はReact/SVGで別に重ねる。実行時は同梱画像のみを読み込み、外部AI・画像サービスへ接続しない。背景画像自体の確認とアプリ画面の目視/操作は区別する。

生成プロンプト（built-in / reference-image edit）:

```text
Recompose this exact watercolor travel-map artwork as a MOBILE PORTRAIT background asset, aspect ratio 3:5 (for example 1152x1920), full-bleed art covering the entire canvas. This is a production illustration asset, not a phone mockup.
Preserve the existing charming Japanese coastal village, saturated blue sea, ivory stone paths, orange roofs, flowers and detailed gouache/watercolor textures. Preserve five recognizable motifs: a red-capped white lighthouse on the LEFT in the upper third; a small craft market with people on the RIGHT near the top; a seafood lunch at a harbor eatery on the RIGHT in the middle; a souvenir shop and cobbled lane at LOWER LEFT; a peaceful ocean-view terrace with a seated person and bench at LOWER RIGHT. Connect the scenes naturally with a winding pale stone lane and sea glimpses; a single continuous landscape, no grid and no isolated photo cards.
The original horizontal artwork was letterboxed in a taller mobile viewport, causing overlaid labels to float above the actual illustration. The new portrait asset must solve that composition issue: paint scenery all the way to the top and bottom edges, no horizontal artwork pasted into the middle, no blank ivory bands outside the landscape, no broad empty header/footer. Leave small, subtly textured calm zones WITHIN the scenic artwork for overlaid HTML callouts at left x25% y18%, right x75% y7%, right x75% y39%, left x25% y73%, right x75% y73%. The callouts will occupy about 44% of the width and 20% of the height, so put the characteristic subjects beside or between these areas and keep the scene distinguishable.
NO text, no letters, no numbers, no category labels, no pins, no dots, no route lines, no watermark, no UI, no border. These will be added as accessible HTML/SVG. One beautiful full-height portrait coastal village illustration, matching the reference style and palette.
```

## マップ風の旅の全体像（2026-11-10）

`public/assets/trip-overview-map-v1.webp` はユーザー提供のマップ画像を参照して内蔵imagegen標準モードで生成した、架空の海辺の町の背景イラスト。1440×1080、WebP quality 88、610,846 bytes。生成PNGはプロジェクト外の既定生成先へ保持し、Sharpで同梱用WebPへ変換した。生成された背景画像の構図・文字なし・5つの場面は確認済みだが、アプリ画面の目視/操作確認とは区別する。利用者が追加する写真ではなく、実行時に外部AI・画像サービスへ接続しない同梱の画面素材。

文字・番号・点線は画像へ含めず、React/SVGで描画する。灯台・クラフト・食事・海辺の休憩・買い物の図案はカテゴリのイメージであり、個々のスポットの位置・距離・設備の事実を表すものではない。

生成プロンプト（built-in / reference-image edit）:

```text
Create a high-resolution production background ILLUSTRATION asset for a Japanese travel brochure's map-like trip overview. Use the attached small illustration as the strong style and composition reference. This output is the illustration asset itself, NOT a phone mockup or a webpage screenshot.
Retain its charming bright watercolor/gouache travel-pamphlet style, warm ivory paper, blue sea and sky, red-roofed lighthouse, quaint Japanese coastal town, sunny cheerful atmosphere and five connected scenic vignettes. The artwork must feel like ONE coherent illustrated coastal village from an elevated oblique perspective.
Composition: landscape 4:3, approximately 1536×1152, full bleed with subtly feathered ivory edges. Five vignettes positioned clearly: top-left red-capped white lighthouse on a rocky coast; top-center a small outdoor handmade crafts market with two people near a stall, a glimpse of blue lake beyond; middle-right a big appetizing seafood lunch bowl and plate at a harbor eatery; bottom-right a peaceful seaside viewing terrace with wooden bench and one person relaxing, overlooking the blue sea; bottom-left little wooden souvenir shops with visible bags, pottery and goods on a cobbled lane. A pale winding stone-paved walking lane visually ties the landscape together. Include textured flowers, orange rooftops, bright sky and sea, with no dominant green UI color.
IMPORTANT: remove ALL overlaid interface elements from the reference: NO title, NO text anywhere, NO Japanese labels, NO category badges, NO numbered pins, NO numbers, NO colored dots, NO dashed orange route line, NO legend or footer caption, NO rounded border. We will add accessible labels, pins and a dashed route using HTML and SVG separately. Do not bake any words or numbers into the asset.
Reserve small calm light-colored areas near the vignette upper edges so category labels can later be overlaid at top-left x20% y30%, top-center x57% y13%, middle-right x82% y42%, bottom-right x75% y75%, and bottom-left x22% y77%. Do not obscure the distinctive subjects. Polished detailed colorful editorial illustration, high-resolution clean edges, faithful to the reference's scenic map feeling, no photoreal collage, no grid of photos, no watermark, no logos.
```

`public/assets/*.png` は架空スポット向けに内蔵imagegen標準モードで生成したラスターイラスト。実在施設の写真ではありません。外部写真素材・外部画像URL・SVG代替は使用していません。各スポットの紹介・タグも提供不足を補うデモ用の補足であり、実施設の営業情報・位置・距離を主張しません。

すべて2026-11-09に生成後目視確認。実行時は同梱ローカル画像のみを読み込みます。画像の復元は同じGit版の `public/assets` から行い、ユーザー追加写真を上書きしません。画面イメージは `docs/design-mockups` に別保管。

2026-11-09追加の架空スポット10件は、当初の既存画像使い回しから専用の `public/assets/*-v1.webp` へ変更した。青空・海を大きく描く構図を避け、料理・道具・遊具など固有の主役と暖色・紫・石色で区別する。対応は追加CSV、生成方式と最終プロンプトは [専用画像の生成記録](spot-image-prompts.md) に記録する。内蔵imagegenで生成し、960×640のWebPへ変換して同梱する。実在施設の写真ではない。以下は既存7画像の生成記録。

生成方法: 内蔵 imagegen。最終プロンプトセット:

## windmill.png

Use case: illustration-story. Asset type: landscape raster illustration used as a fictional travel spot image in a local Japanese web-app demo. Primary request: a small orange-roofed windmill on a sunlit rolling hill with golden wildflowers and a bright blue sky, fictional Japanese countryside. Style: polished hand-painted gouache and watercolor travel-pamphlet artwork, clear composition, rich but natural texture, no photo-real impersonation of any actual facility. Color palette: bright sky blue, deep ocean blue, coral orange roofs, sunshine yellow and ivory; keep vegetation subdued and not the main brand color. Landscape 3:2 composition with the subject visible in the middle for mobile cropping. This is an invented place, not a representation of a real named destination. No typography, no letters, no numbers, no logos, no watermark, no frame, no interface. Cheerful natural daylight except the evening market. Output one scenic illustration.

## coast.png

Use case: illustration-story. Asset type: landscape raster illustration used as a fictional travel spot image in a local Japanese web-app demo. Primary request: a scenic coastal observation terrace with pale stone railings overlooking a calm deep-blue sea and small islands, no people. Style: polished hand-painted gouache and watercolor travel-pamphlet artwork, clear composition, rich but natural texture, no photo-real impersonation of any actual facility. Color palette: bright sky blue, deep ocean blue, coral orange roofs, sunshine yellow and ivory; keep vegetation subdued and not the main brand color. Landscape 3:2 composition with the subject visible in the middle for mobile cropping. This is an invented place, not a representation of a real named destination. No typography, no letters, no numbers, no logos, no watermark, no frame, no interface. Cheerful natural daylight except the evening market. Output one scenic illustration.

## music.png

Use case: illustration-story. Asset type: landscape raster illustration used as a fictional travel spot image in a local Japanese web-app demo. Primary request: an inviting small wooden music hall with a warm orange roof on a highland meadow, a piano visible through open doors, no logos or writing. Style: polished hand-painted gouache and watercolor travel-pamphlet artwork, clear composition, rich but natural texture, no photo-real impersonation of any actual facility. Color palette: bright sky blue, deep ocean blue, coral orange roofs, sunshine yellow and ivory; keep vegetation subdued and not the main brand color. Landscape 3:2 composition with the subject visible in the middle for mobile cropping. This is an invented place, not a representation of a real named destination. No typography, no letters, no numbers, no logos, no watermark, no frame, no interface. Cheerful natural daylight except the evening market. Output one scenic illustration.

## street.png

Use case: illustration-story. Asset type: landscape raster illustration used as a fictional travel spot image in a local Japanese web-app demo. Primary request: a cheerful Japanese port-town stone-paved pedestrian lane with traditional wooden shopfronts and a glimpse of blue sea, colorful awnings, no signage text. Style: polished hand-painted gouache and watercolor travel-pamphlet artwork, clear composition, rich but natural texture, no photo-real impersonation of any actual facility. Color palette: bright sky blue, deep ocean blue, coral orange roofs, sunshine yellow and ivory; keep vegetation subdued and not the main brand color. Landscape 3:2 composition with the subject visible in the middle for mobile cropping. This is an invented place, not a representation of a real named destination. No typography, no letters, no numbers, no logos, no watermark, no frame, no interface. Cheerful natural daylight except the evening market. Output one scenic illustration.

## market.png

Use case: illustration-story. Asset type: landscape raster illustration used as a fictional travel spot image in a local Japanese web-app demo. Primary request: a friendly Japanese outdoor food market at early evening, warm orange paper lanterns and small food stalls, blue twilight, no people close-up, no readable signage. Style: polished hand-painted gouache and watercolor travel-pamphlet artwork, clear composition, rich but natural texture, no photo-real impersonation of any actual facility. Color palette: bright sky blue, deep ocean blue, coral orange roofs, sunshine yellow and ivory; keep vegetation subdued and not the main brand color. Landscape 3:2 composition with the subject visible in the middle for mobile cropping. This is an invented place, not a representation of a real named destination. No typography, no letters, no numbers, no logos, no watermark, no frame, no interface. Cheerful natural daylight except the evening market. Output one scenic illustration.

## lighthouse.png

Use case: illustration-story. Asset type: landscape raster illustration used as a fictional travel spot image in a local Japanese web-app demo. Primary request: a white lighthouse with a coral-red cap on a rocky seaside cape above a vivid blue sea, simple orange-roofed houses, sunny weather. Style: polished hand-painted gouache and watercolor travel-pamphlet artwork, clear composition, rich but natural texture, no photo-real impersonation of any actual facility. Color palette: bright sky blue, deep ocean blue, coral orange roofs, sunshine yellow and ivory; keep vegetation subdued and not the main brand color. Landscape 3:2 composition with the subject visible in the middle for mobile cropping. This is an invented place, not a representation of a real named destination. No typography, no letters, no numbers, no logos, no watermark, no frame, no interface. Cheerful natural daylight except the evening market. Output one scenic illustration.

## lake.png

Use case: illustration-story. Asset type: landscape raster illustration used as a fictional travel spot image in a local Japanese web-app demo. Primary request: a tranquil clear blue lake reflecting distant soft blue mountains, a short wooden pier and an ivory picnic bench, sunny and welcoming. Style: polished hand-painted gouache and watercolor travel-pamphlet artwork, clear composition, rich but natural texture, no photo-real impersonation of any actual facility. Color palette: bright sky blue, deep ocean blue, coral orange roofs, sunshine yellow and ivory; keep vegetation subdued and not the main brand color. Landscape 3:2 composition with the subject visible in the middle for mobile cropping. This is an invented place, not a representation of a real named destination. No typography, no letters, no numbers, no logos, no watermark, no frame, no interface. Cheerful natural daylight except the evening market. Output one scenic illustration.


