from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
import os
O='/workspace/design/podsta-brand'
PLUM='#2B1B3D';CORAL='#FF6B57';SUN='#FFC547';MINT='#3DD9A8';CREAM='#FFF7EE';BERRY='#E8457A'
f=TTFont(O+'/fonts/Fredoka.ttf'); f=instantiateVariableFont(f,{'wght':600,'wdth':100})
gs=f.getGlyphSet(); cmap=f.getBestCmap(); upm=f['head'].unitsPerEm
def text_path(s):
    x=0;parts=[];hm=f['hmtx']
    for ch in s:
        g=cmap[ord(ch)];p=SVGPathPen(gs);gs[g].draw(p)
        parts.append(f'<path transform="translate({x},0)" d="{p.getCommands()}"/>');x+=hm[g][0]
    return parts,x
def mark(bg=True,scale=1.0):
    # squircle gradient tile + white pea-pod with 3 "peas": middle is camera lens
    g='''<defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A4C"/><stop offset=".55" stop-color="#FF6B57"/><stop offset="1" stop-color="#E8457A"/></linearGradient></defs>'''
    tile='<rect x="0" y="0" width="512" height="512" rx="120" fill="url(#pg)"/>' if bg=='tile' else ('<rect width="512" height="512" fill="url(#pg)"/>' if bg=='full' else '')
    s=scale; c=256
    art=f'''<g transform="translate({c} {c}) scale({s}) rotate(-18) translate(-256 -256)">
<path d="M70 256 C70 170 150 150 256 150 C362 150 442 170 442 256 C442 342 362 362 256 362 C150 362 70 342 70 256Z" fill="#FFF7EE"/>
<path d="M442 256 C470 236 482 206 478 178" stroke="#3DD9A8" stroke-width="22" stroke-linecap="round" fill="none"/>
<circle cx="150" cy="256" r="44" fill="#3DD9A8"/>
<circle cx="256" cy="256" r="62" fill="#2B1B3D"/><circle cx="256" cy="256" r="34" fill="#FFC547"/><circle cx="242" cy="241" r="10" fill="#FFF7EE"/>
<circle cx="362" cy="256" r="44" fill="#3DD9A8"/>
</g>'''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">{g}{tile}{art}</svg>'
W=lambda n,s:open(os.path.join(O,n),'w').write(s)
W('podsta-mark.svg',mark('tile',1.0))
W('podsta-mark-transparent.svg',mark(None,1.0))
W('src/maskable.svg',mark('full',0.72))
W('src/apple.svg',mark('full',0.86))
W('favicon.svg',mark('tile',1.12).replace('rx="120"','rx="130"'))
def wordmark(color,name):
    parts,adv=text_path('podsta'); asc=760;desc=260
    h=asc+desc; mk=h; gap=120; tw=mk+gap+adv
    inner=mark('tile',1.0).split('>',1)[1].rsplit('</svg>',1)[0]
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {tw} {h}" width="{tw/2:.0f}" height="{h/2:.0f}">
<svg x="0" y="0" width="{mk}" height="{mk}" viewBox="0 0 512 512">{inner}</svg>
<g fill="{color}" transform="translate({mk+gap} {asc}) scale(1 -1)">{''.join(parts)}</g></svg>'''
    W(name,svg)
    parts2='<g fill="%s" transform="translate(0 %d) scale(1 -1)">%s</g>'%(color,asc,''.join(parts))
    W(name.replace('podsta-wordmark','podsta-wordtype'),f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {adv} {h}" width="{adv/2:.0f}" height="{h/2:.0f}">{parts2}</svg>')
wordmark(PLUM,'podsta-wordmark.svg'); wordmark(CREAM,'podsta-wordmark-light.svg')
# illustrations 600x450, cream bg circle blob
def ill(name,body):
    W('illustrations/'+name+'.svg',f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450"><ellipse cx="300" cy="240" rx="230" ry="180" fill="#FFE9D9"/>{body}</svg>')
ill('first-post','''
<rect x="190" y="90" width="220" height="280" rx="28" fill="#fff" stroke="#2B1B3D" stroke-width="8"/>
<rect x="215" y="118" width="170" height="150" rx="16" fill="#FFC547"/>
<path d="M215 240 L270 190 L315 230 L345 205 L385 245 L385 252 Q385 268 369 268 L231 268 Q215 268 215 252Z" fill="#3DD9A8"/>
<circle cx="350" cy="150" r="18" fill="#FF6B57"/>
<rect x="215" y="290" width="120" height="14" rx="7" fill="#2B1B3D" opacity=".85"/><rect x="215" y="318" width="80" height="14" rx="7" fill="#2B1B3D" opacity=".35"/>
<circle cx="430" cy="110" r="38" fill="#FF6B57"/><path d="M430 92 V128 M412 110 H448" stroke="#fff" stroke-width="10" stroke-linecap="round"/>
<path d="M150 150 l10 -22 l10 22 l-10 22z M470 300 l8 -16 l8 16 l-8 16z" fill="#E8457A"/>''')
ill('no-followers','''
<circle cx="300" cy="200" r="70" fill="#FF6B57"/><circle cx="300" cy="180" r="28" fill="#FFF7EE"/><path d="M254 245 Q300 205 346 245" fill="#FFF7EE"/>
<circle cx="170" cy="280" r="44" fill="none" stroke="#2B1B3D" stroke-width="7" stroke-dasharray="14 12"/>
<circle cx="430" cy="280" r="44" fill="none" stroke="#2B1B3D" stroke-width="7" stroke-dasharray="14 12"/>
<circle cx="300" cy="345" r="36" fill="none" stroke="#2B1B3D" stroke-width="7" stroke-dasharray="14 12"/>
<path d="M170 266 v28 M156 280 h28 M430 266 v28 M416 280 h28 M300 331 v28 M286 345 h28" stroke="#3DD9A8" stroke-width="8" stroke-linecap="round"/>
<path d="M395 120 c0 -18 26 -18 26 0 c0 -18 26 -18 26 0 c0 20 -26 34 -26 34 c0 0 -26 -14 -26 -34z" fill="#E8457A"/>''')
ill('whats-a-pod','''
<g transform="rotate(-12 300 230)">
<path d="M110 230 C110 160 190 145 300 145 C410 145 490 160 490 230 C490 300 410 315 300 315 C190 315 110 300 110 230Z" fill="#3DD9A8" stroke="#2B1B3D" stroke-width="8"/>
<path d="M140 230 C140 185 200 175 300 175 C400 175 460 185 460 230 C460 275 400 285 300 285 C200 285 140 275 140 230Z" fill="#FFF7EE"/>
<rect x="170" y="195" width="70" height="70" rx="14" fill="#FFC547"/><circle cx="300" cy="230" r="38" fill="#FF6B57"/><path d="M285 230 l10 10 l20 -22" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="360" y="200" width="66" height="60" rx="12" fill="#E8457A"/><circle cx="393" cy="230" r="14" fill="#FFF7EE"/>
<path d="M490 230 C520 210 530 180 522 150" stroke="#2B1B3D" stroke-width="8" fill="none" stroke-linecap="round"/></g>
<rect x="250" y="350" width="100" height="70" rx="14" fill="#2B1B3D"/><path d="M272 350 v-22 a28 28 0 0 1 56 0 v22" stroke="#2B1B3D" stroke-width="10" fill="none"/><circle cx="300" cy="383" r="10" fill="#FFC547"/>''')
ill('welcome','''
<path d="M300 90 l120 70 v140 l-120 70 l-120 -70 v-140z" fill="none"/>
<circle cx="300" cy="225" r="120" fill="#FF6B57"/>
<g transform="translate(300 225) scale(.42) rotate(-18) translate(-256 -256)"><path d="M70 256 C70 170 150 150 256 150 C362 150 442 170 442 256 C442 342 362 362 256 362 C150 362 70 342 70 256Z" fill="#FFF7EE"/><circle cx="150" cy="256" r="44" fill="#3DD9A8"/><circle cx="256" cy="256" r="62" fill="#2B1B3D"/><circle cx="256" cy="256" r="34" fill="#FFC547"/><circle cx="362" cy="256" r="44" fill="#3DD9A8"/></g>
<path d="M140 120 l14 -30 l14 30 l-14 30z" fill="#FFC547"/><path d="M450 330 l10 -22 l10 22 l-10 22z" fill="#E8457A"/><circle cx="460" cy="130" r="14" fill="#3DD9A8"/><circle cx="130" cy="330" r="10" fill="#2B1B3D"/>
<path d="M200 380 q100 40 200 0" stroke="#2B1B3D" stroke-width="8" fill="none" stroke-linecap="round"/>''')
