# 画像素材と生成記録

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


