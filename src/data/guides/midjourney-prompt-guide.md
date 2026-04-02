---
title: "Midjourney Prompt Guide: From Beginner to Advanced"
description: "Master Midjourney prompt writing with this comprehensive guide. Learn the basic prompt structure, Midjourney-specific parameters, style keywords, and advanced techniques like multi-prompts and permutations."
author: "Roshawn Franklin"
pubDate: 2026-04-02
difficulty: "intermediate"
tags:
  - midjourney
  - image-generation
  - art
  - visual-content
draft: false
---

Midjourney has established itself as the go-to AI image generation tool for anyone who cares about visual quality. Whether you are creating marketing visuals, concept art, product mockups, or social media content, Midjourney consistently produces images that look polished, intentional, and professional.

But getting those stunning results is not random. It comes down to understanding how Midjourney interprets prompts and knowing which words, structures, and parameters give you control over the output.

This guide takes you from writing your first Midjourney prompt to mastering advanced techniques that professional creators use every day.

## What Makes Midjourney Different from DALL-E and Stable Diffusion

Before diving into prompt techniques, it helps to understand what sets Midjourney apart from other image generators.

**Midjourney** prioritizes aesthetic quality and artistic interpretation. It tends to produce images that look like they were created by a skilled artist or photographer, even from simple prompts. It has a strong "opinion" about composition, lighting, and color, which means it often produces beautiful results with minimal guidance. The tradeoff is that it can sometimes be harder to get very specific, literal compositions.

**DALL-E** (via ChatGPT) prioritizes prompt adherence. It tries to match your description as literally as possible. This makes it better for specific compositions (like "a red ball on top of a blue cube") but sometimes results in images that feel flatter or less artistic.

**Stable Diffusion** prioritizes customization and control. It is open-source, meaning you can fine-tune models, train on your own data, and run it locally. It offers the most technical control but requires the most technical knowledge.

**The bottom line:** If you want images that look incredible with the least amount of technical effort, Midjourney is the tool. If you need precise compositional control, consider DALL-E. If you want full technical customization, explore Stable Diffusion.

## Basic Prompt Structure

Every Midjourney prompt follows a core structure. Mastering this structure is the single most impactful thing you can do to improve your results.

### The Five Elements

A strong Midjourney prompt combines five elements:

**Subject + Style + Medium + Lighting + Composition**

You do not need all five in every prompt, but the more elements you include, the more control you have over the output.

### Subject

This is **what** you want in the image. Be specific and descriptive.

- **Weak:** "a woman"
- **Strong:** "a woman in her 30s with curly auburn hair, wearing a tailored navy blazer, looking directly at the camera with a confident expression"

The more detail you provide about your subject, the closer the output matches your vision. Include details about age, clothing, expression, pose, and distinguishing features.

### Style

This defines the **artistic approach**. Style keywords dramatically change the output.

Common style keywords that work well in Midjourney:

- **Cinematic** -- produces film-like images with dramatic lighting and depth of field
- **Editorial** -- clean, magazine-quality compositions
- **Minimalist** -- simple compositions with lots of negative space
- **Retro** -- vintage aesthetics, film grain, muted color palettes
- **Hyperrealistic** -- photographic quality with extreme detail
- **Impressionist** -- soft, painterly quality inspired by the art movement
- **Surrealist** -- dreamlike, unexpected combinations
- **Art Deco** -- geometric patterns, bold lines, 1920s glamour
- **Cyberpunk** -- neon lights, dark environments, futuristic tech
- **Watercolor** -- soft, translucent, organic feel

### Medium

This tells Midjourney **what material or technique** the image should look like.

- "oil painting on canvas"
- "digital illustration"
- "35mm film photography"
- "charcoal sketch"
- "3D render"
- "watercolor on textured paper"
- "vector illustration"
- "screen print"
- "pencil drawing"
- "macro photography"

### Lighting

Lighting is one of the most powerful elements for setting mood and visual quality.

- **Golden hour** -- warm, soft, directional light
- **Dramatic side lighting** -- high contrast, moody
- **Soft diffused light** -- even, flattering, no harsh shadows
- **Backlighting** -- silhouettes and rim light effects
- **Studio lighting** -- clean, professional, controlled
- **Neon lighting** -- colorful, urban, electric
- **Natural window light** -- soft, authentic, editorial
- **Volumetric lighting** -- visible light rays, atmospheric

### Composition

Composition guides the framing and visual arrangement.

- "close-up portrait"
- "wide-angle landscape"
- "bird's eye view"
- "symmetrical composition"
- "rule of thirds"
- "centered composition"
- "dutch angle"
- "shot from below, looking up"
- "over the shoulder perspective"

### Putting It All Together

Here is a complete prompt using all five elements:

> A woman in her 30s with curly auburn hair wearing a tailored navy blazer, editorial style, 35mm film photography, soft natural window light, close-up portrait with shallow depth of field

That prompt gives Midjourney clear instructions about the subject, artistic style, medium, lighting, and composition. The result will be dramatically better than "a professional woman portrait."

## Midjourney-Specific Parameters

Midjourney offers parameters that you append to the end of your prompt to fine-tune the output. These are written with double dashes.

### --ar (Aspect Ratio)

Controls the width-to-height ratio of the image.

- `--ar 1:1` -- Square (default). Great for profile pictures and social media.
- `--ar 16:9` -- Widescreen. Perfect for YouTube thumbnails, website heroes, and presentations.
- `--ar 9:16` -- Vertical. Ideal for Instagram Stories, TikTok, and Pinterest.
- `--ar 4:3` -- Classic photo ratio. Good for blog images.
- `--ar 3:2` -- Standard photography ratio.
- `--ar 21:9` -- Ultra-widescreen. Cinematic feel, great for website banners.

> **Tip:** Always set the aspect ratio to match where the image will be used. A `--ar 16:9` YouTube thumbnail looks very different from a `--ar 1:1` Instagram post, even with the same prompt.

### --stylize (or --s)

Controls how strongly Midjourney applies its own artistic interpretation. Values range from 0 to 1000.

- `--s 0` -- Minimal artistic interpretation. Closest to your literal description.
- `--s 100` -- Low stylization. Good balance of accuracy and beauty.
- `--s 250` -- Default. Midjourney's standard artistic touch.
- `--s 500` -- High stylization. More artistic, less literal.
- `--s 750-1000` -- Maximum artistic interpretation. Beautiful but may deviate significantly from your prompt.

Use lower values when you need the image to match your description precisely. Use higher values when you want Midjourney to "do its thing" and produce something visually stunning.

### --chaos (or --c)

Controls how varied the four initial image options are. Values range from 0 to 100.

- `--c 0` -- All four options will be very similar.
- `--c 25` -- Moderate variation. Good for exploring options.
- `--c 50` -- High variation. Useful when you are brainstorming.
- `--c 100` -- Maximum variation. Each option will be very different.

Use low chaos when you know what you want. Use high chaos when you are exploring ideas and want to see different interpretations.

### --quality (or --q)

Controls rendering quality and generation time.

- `--q .25` -- Fastest, lowest detail. Good for quick concept exploration.
- `--q .5` -- Moderate quality. Good balance for iteration.
- `--q 1` -- Default. Full quality rendering.

Use lower quality during the exploration phase when you are testing prompt ideas, then switch to full quality for your final output.

### --no (Negative Prompts)

Tells Midjourney what to **exclude** from the image.

- `--no text, words, letters` -- Removes any text from the image.
- `--no people, humans` -- Removes people.
- `--no background, busy background` -- Simplifies the background.

This parameter is incredibly useful for cleaning up common issues. If Midjourney keeps adding unwanted elements, use `--no` to eliminate them.

### --seed

Uses a specific seed number to reproduce similar results. Useful when you find a composition you like and want to create variations.

### --tile

Creates seamless tileable patterns. Great for backgrounds, textures, and wallpapers.

## 10 Prompt Examples from the Library

Let us walk through ten image generation prompts that demonstrate different techniques and use cases.

### 1. Cinematic Portrait

The [Cinematic Portrait Generator](/prompts/cinematic-portrait-generator/) produces stunning portrait photography with film-quality lighting and color grading.

> A portrait of a [SUBJECT] in cinematic style, shallow depth of field, anamorphic lens flare, warm color grading, dramatic side lighting, 35mm film grain, 4K detail --ar 3:2 --s 500

This prompt works because "cinematic" combined with specific photography terms (anamorphic, shallow depth of field, 35mm film grain) triggers Midjourney's understanding of high-end film production aesthetics.

### 2. Product Photography

The [Product Photography Prompt](/prompts/product-photography-prompt/) generates clean, commercial-quality product shots.

> A [PRODUCT] on a clean white surface, soft studio lighting, professional product photography, high-key lighting, subtle shadow, commercial quality, 8K detail --ar 4:3 --s 250 --no text, labels

The `--no text, labels` is critical here. Without it, Midjourney might add fake product labels or text to the image.

### 3. Fantasy Landscape

The [Fantasy Landscape Creator](/prompts/fantasy-landscape-creator/) generates breathtaking fictional environments.

> A vast fantasy landscape with [ELEMENTS], epic scale, matte painting style, volumetric lighting, golden hour, atmospheric perspective, highly detailed, concept art for film --ar 21:9 --s 750

The ultra-widescreen `--ar 21:9` aspect ratio gives these landscapes a cinematic scope that makes them feel immersive and grand.

### 4. Sci-Fi Concept Art

The [Sci-Fi Concept Art Prompt](/prompts/sci-fi-concept-art-prompt/) produces futuristic visuals suitable for game design, film pre-production, or creative projects.

> A [SCENE_DESCRIPTION] in a futuristic megacity, cyberpunk atmosphere, neon-lit rain-slicked streets, holographic advertisements, dramatic low angle, concept art by Syd Mead, detailed environment design --ar 16:9 --s 500

Referencing a specific artist (Syd Mead, known for Blade Runner concept art) gives Midjourney a strong aesthetic target to aim for.

### 5. Editorial Illustration

The [Editorial Illustration Prompt](/prompts/editorial-illustration-prompt/) creates magazine-quality conceptual illustrations.

> An editorial illustration about [CONCEPT], metaphorical visual representation, clean vector style, limited color palette of [COLORS], modern graphic design, flat design with subtle textures, magazine cover quality --ar 3:4 --s 350

The "limited color palette" instruction keeps the image cohesive and professional, avoiding the visual chaos that can happen with unrestricted colors.

### 6. Architectural Visualization

The [Architectural Visualization Prompt](/prompts/architectural-visualization-prompt/) generates realistic building renders and interior designs.

> An architectural visualization of a [BUILDING_TYPE], modern design, floor-to-ceiling windows, natural materials, warm ambient lighting, interior photography style, Dezeen magazine aesthetic, photorealistic render --ar 16:9 --s 300

Referencing "Dezeen magazine aesthetic" activates high-end architectural photography patterns that produce clean, aspirational spaces.

### 7. Abstract Art Wallpaper

The [Abstract Art Wallpaper](/prompts/abstract-art-wallpaper/) prompt generates desktop and phone backgrounds with artistic flair.

> Abstract art composition with flowing organic shapes, gradient from [COLOR_1] to [COLOR_2], liquid marble texture, depth and dimension, high resolution desktop wallpaper, smooth transitions --ar 16:9 --s 600 --no text

High stylization (`--s 600`) lets Midjourney get creative with the abstract elements while the color gradient instruction keeps the palette controlled.

### 8. Flat Lay Product Composition

The [Flat Lay Product Composition](/prompts/flat-lay-product-composition/) creates Instagram-worthy overhead shots.

> A flat lay composition of [ITEMS] arranged on a [SURFACE], overhead photography, soft even lighting, styled with props, Instagram aesthetic, clean and organized layout, warm tones --ar 1:1 --s 250

The `--ar 1:1` square format is intentional here, as flat lay content is primarily used on Instagram where square images still dominate the feed.

### 9. Retro Pixel Art Scene

The [Retro Pixel Art Scene](/prompts/retro-pixel-art-scene/) generates nostalgic 8-bit and 16-bit style artwork.

> A [SCENE] in retro pixel art style, 16-bit aesthetic, vibrant color palette, detailed pixel work, nostalgic video game art, clean pixel edges, warm CRT glow effect --ar 16:9 --s 400

The "CRT glow effect" adds an authentic retro television feel that makes the pixel art feel nostalgic rather than just low-resolution.

### 10. Isometric Icon Set

The [Isometric Icon Set Generator](/prompts/isometric-icon-set-generator/) produces consistent icon sets for presentations, apps, and websites.

> An isometric view of a [OBJECT], 3D icon style, soft pastel colors, clean minimal design, subtle shadows, white background, consistent with a icon set, vector quality --ar 1:1 --s 200 --no text

Low stylization (`--s 200`) keeps these icons clean and consistent. Running this prompt multiple times with different `[OBJECT]` values and the same seed creates a cohesive set.

## Advanced Techniques

Once you are comfortable with basic prompts and parameters, these advanced techniques will take your Midjourney work to the next level.

### Multi-Prompts

Multi-prompts use double colons `::` to separate concepts and assign relative importance (weights) to each part.

```
futuristic city::2 sunset sky::1 flying vehicles::1.5
```

The numbers after `::` control how much weight Midjourney gives each concept. In this example, the futuristic city is the primary focus (weight 2), flying vehicles are secondary (weight 1.5), and the sunset sky is the background element (weight 1).

This is powerful when your prompt has multiple elements and you want to control which ones dominate the image. Without weights, Midjourney distributes attention evenly, which sometimes means your main subject gets lost.

### Permutations

Permutations use curly braces `{}` to generate multiple variations from a single prompt.

```
a {red, blue, green} sports car on a mountain road, cinematic --ar 16:9
```

This generates three separate jobs -- one for each color. Permutations are incredibly efficient when you want to explore variations of one element without submitting multiple prompts.

You can combine multiple permutation sets:

```
a {cat, dog} wearing a {top hat, crown}, studio portrait --ar 1:1
```

This generates four images: cat with top hat, cat with crown, dog with top hat, dog with crown.

### Image Prompting

You can use an existing image as input by pasting its URL at the beginning of your prompt. Midjourney uses the image as a reference for style, composition, or content.

```
[image URL] a modern office interior, minimalist design, warm lighting --ar 16:9
```

This is useful for:
- Maintaining a consistent style across multiple images
- Using a mood board image as a starting point
- Creating variations of an existing composition
- Matching a brand's visual style

### Style References (--sref)

The `--sref` parameter lets you provide an image URL as a pure style reference. Midjourney extracts the artistic style from that image and applies it to your subject.

```
a mountain landscape at sunset --sref [image URL] --ar 16:9
```

This is different from image prompting because it only borrows the style, not the content. Powerful for creating consistent visual brands across different subjects.

### Character References (--cref)

The `--cref` parameter maintains character consistency across multiple generations. Provide an image of a character, and Midjourney will try to keep that character's appearance consistent in new compositions.

```
a woman walking through a futuristic market --cref [character image URL] --ar 16:9
```

This is game-changing for anyone creating visual narratives, character-based content, or brand mascots that need to appear in multiple scenes.

## Common Mistakes and How to Avoid Them

### Mistake 1: Being Too Vague

**Bad:** "a cool landscape"
**Better:** "a dramatic coastal cliff at golden hour, massive waves crashing below, lighthouse in the distance, cinematic photography, wide angle, volumetric fog --ar 21:9"

Midjourney rewards specificity. Every descriptive word you add gives the AI more to work with.

### Mistake 2: Too Many Subjects

When you pack too many subjects into one prompt, Midjourney struggles to give each one proper attention. The result is often a muddled image where nothing is the clear focal point.

**Bad:** "a knight, a dragon, a castle, a princess, a wizard, and a forest with a river"
**Better:** "a lone knight facing a massive dragon outside a gothic castle, dramatic low angle, cinematic lighting, dark fantasy atmosphere --ar 16:9"

Pick one or two main subjects and let the rest become supporting elements.

### Mistake 3: Ignoring Composition

If you do not specify composition, Midjourney chooses for you. Sometimes it chooses well, but often you end up with a default medium shot that does not serve your vision.

Always include a composition instruction: close-up, wide angle, bird's eye view, low angle, centered, rule of thirds, etc.

### Mistake 4: Not Using Negative Prompts

If Midjourney keeps adding something you do not want (text, extra people, busy backgrounds), use `--no` to explicitly exclude it. This is faster and more effective than trying to describe your way around unwanted elements.

### Mistake 5: Skipping the Iteration Process

Your first generation is a starting point, not the final product. Use the variation buttons (V1-V4) to explore alternatives. Use upscale to get higher resolution. Use the remix feature to tweak your prompt based on what you see. The best Midjourney creators run 5-10 iterations before settling on a final image.

### Mistake 6: Wrong Aspect Ratio

A common rookie mistake is generating images in the default 1:1 square when the final use case requires a different ratio. Always match `--ar` to your output destination. A YouTube thumbnail needs `--ar 16:9`. An Instagram Story needs `--ar 9:16`. A blog header needs `--ar 3:1` or `--ar 4:1`.

### Mistake 7: Over-Stylizing

High `--s` values produce beautiful images, but they can deviate significantly from your description. If accuracy matters more than artistic flair, keep `--s` between 100 and 300.

## Building a Visual Content Workflow

For professionals using Midjourney regularly, here is a recommended workflow:

1. **Brief:** Define what you need (subject, style, where it will be used, aspect ratio)
2. **Explore:** Run your prompt with `--c 50` and `--q .5` to quickly explore options
3. **Refine:** Take the best option, adjust the prompt, lower chaos, raise quality
4. **Iterate:** Use V1-V4 variations and remix to dial in the details
5. **Upscale:** Generate the final high-resolution version
6. **Post-process:** Make final adjustments in Photoshop, Lightroom, or Canva if needed

This workflow prevents wasting generation credits on fully rendered images during the exploration phase.

---

## Browse All Image Generation Prompts

Ready to start creating? Our library has dozens of image generation prompts for every use case, from [product photography](/prompts/product-photography-prompt/) to [sci-fi concept art](/prompts/sci-fi-concept-art-prompt/) to [abstract wallpapers](/prompts/abstract-art-wallpaper/).

Each prompt comes with the full prompt text, variable explanations, and tips for customization.

[Browse All Image Generation Prompts](/prompts/?type=image) | [Browse the Full Prompt Library](/prompts/)
