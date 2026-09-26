/* TAVO HUB characteristics ("facets"): one vocabulary for the admin resource form and the public filters.
   Stored in the resource's ordinary tags as "group:value" (e.g. "tone:dark", "color:pink"), so no schema change.
   Each value: [id, Russian label (admin), English label (site)]. Add a group or a value here and both sides pick it up. */
(()=>{
  const FACETS={
    theme:[
      {key:'tone',ru:'Тон',en:'Tone',card:false,values:[['light','Светлая','Light'],['dark','Тёмная','Dark']]},
      {key:'style',ru:'Стиль',en:'Style',values:[['soft','Soft','Soft'],['dark','Dark','Dark'],['minimal','Минимализм','Minimal'],['vintage','Винтаж','Vintage'],['gothic','Готика','Gothic'],['cyberpunk','Киберпанк','Cyberpunk']]},
      {key:'color',ru:'Цвет',en:'Color',values:[['pink','Розовый','Pink'],['red','Красный','Red'],['purple','Фиолетовый','Purple'],['blue','Голубой','Blue'],['green','Зелёный','Green'],['beige','Бежевый','Beige'],['brown','Коричневый','Brown'],['mono','Чёрно-белый','Black & white']]},
      {key:'motif',ru:'Мотивы',en:'Motifs',values:[['flowers','Цветы','Flowers'],['stars','Звёзды / космос','Stars & space'],['nature','Природа','Nature'],['lace','Кружево','Lace'],['animals','Животные','Animals'],['hearts','Сердечки','Hearts']]}
    ],
    plugin:[
      {key:'purpose',ru:'Назначение',en:'Purpose',values:[['memory','Память','Memory'],['relationships','Отношения','Relationships'],['stats','Система / статы','Stats & systems'],['time','Время / календарь','Time & calendar'],['inventory','Инвентарь','Inventory'],['chat-style','Оформление чата','Chat styling']]}
    ]
  };
  const parse=tag=>{const m=/^([a-z-]+):(.+)$/.exec(String(tag||'').trim().toLowerCase());return m?{key:m[1],value:m[2].trim()}:null};
  const groupsFor=type=>FACETS[String(type||'').toLowerCase().replace(/s$/,'')]||[];
  // Label of a "group:value" tag for a resource type, or null when the tag is not a known facet.
  const label=(tag,type,lang='en')=>{const p=parse(tag);if(!p)return null;for(const g of (type?groupsFor(type):Object.values(FACETS).flat())){if(g.key!==p.key)continue;const v=g.values.find(x=>x[0]===p.value);if(v)return{group:g,text:lang==='ru'?v[1]:v[2]}}return null};
  window.HUB_FACETS={FACETS,parse,groupsFor,label};
})();
