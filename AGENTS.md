<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- The game is a static three.js app in public/game, shown full-screen at / via iframe; keeps the original vanilla JS untouched by the React build.
- The player mesh is the GLB at public/game/models/player/hero.glb, driven by retargeting the hidden original rig (public/game/player-avatar.js); keep animations on the original rig.
- Jump presentation follows airborne height and vertical velocity on the original rig, separate from movement physics, so takeoff and landing stay synchronized.
