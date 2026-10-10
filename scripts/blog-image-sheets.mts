// Contact sheets of every blog post's images, one row per post (index 0 = hero), for eyeballing repeats/off-topic shots.
// Run: OUT=<dir> [ONLY=slug,slug] NODE_OPTIONS=--conditions=react-server npx tsx scripts/blog-image-sheets.mts  (red tile = remote/missing image)
import sharp from "sharp";
import {existsSync, mkdirSync} from "node:fs";
import {blogPosts} from "../src/data/blog.ts";
const OUT = process.env.OUT!; mkdirSync(OUT,{recursive:true});
const only = process.env.ONLY?.split(",");
const W=150,H=100,PER=12,LABEL=16;
function collect(post:any){const out:string[]=[];const m=(x:any)=>{if(!x)return;if(x.type==="image"&&x.image?.src)out.push(x.image.src);if(x.type==="gallery")for(const i of x.images??[])out.push(i.src)};
 if(post.featuredImage?.src)out.push(post.featuredImage.src);for(const s of post.sections??[]){m(s.media);for(const c of s.cards??[])if(c.image?.src)out.push(c.image.src);for(const sub of s.subsections??[])m(sub.media);for(const x of (s.html??"").matchAll(/<img[^>]+src="([^"]+)"/g))out.push(x[1]);}return out;}
let posts=(blogPosts as any[]).filter(p=>!only||only.includes(p.slug));
const esc=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;");
for(let s=0;s*PER<posts.length;s++){
 const chunk=posts.slice(s*PER,s*PER+PER);
 const maxN=Math.max(...chunk.map(p=>collect(p).length));
 const cols=Math.min(maxN,10); const rowsPer=chunk.map(p=>Math.ceil(collect(p).length/cols)||1);
 const width=cols*(W+4)+4; const height=rowsPer.reduce((a,r)=>a+LABEL+r*(H+4),0)+4;
 const comps:any[]=[]; let y=4;
 for(const p of chunk){const imgs=collect(p);
  comps.push({input:Buffer.from(`<svg width="${width}" height="${LABEL}"><text x="4" y="12" font-size="12" font-family="Helvetica" fill="#ff0">${esc(p.slug)}</text></svg>`),left:0,top:y}); y+=LABEL;
  for(let i=0;i<imgs.length;i++){const f="public"+imgs[i].split("?")[0];const x=4+(i%cols)*(W+4);const yy=y+Math.floor(i/cols)*(H+4);
   let buf; if(imgs[i].startsWith("/")&&existsSync(f)) buf=await sharp(f).resize(W,H,{fit:"cover"}).png().toBuffer(); else buf=await sharp({create:{width:W,height:H,channels:3,background:"#800"}}).png().toBuffer();
   comps.push({input:buf,left:x,top:yy});
   comps.push({input:Buffer.from(`<svg width="${W}" height="14"><rect width="22" height="14" fill="#000"/><text x="2" y="11" font-size="11" font-family="Helvetica" fill="#fff">${i}</text></svg>`),left:x,top:yy});}
  y+=(Math.ceil(imgs.length/cols)||1)*(H+4);}
 await sharp({create:{width,height,channels:3,background:"#222"}}).composite(comps).png().toFile(`${OUT}/sheet-${String(s).padStart(2,"0")}.png`);
}
console.log("sheets", Math.ceil(posts.length/PER));
