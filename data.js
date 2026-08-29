window.TAG_META = {
  "Dominant":"😈",
  "Submissive":"🧎",
  "Switch":"☯️",
  "Game":"🎮",
  "Anime":"🌸",
  "Multiple":"👥",
  "Non-Human":"👽",
  "Demi-Human":"🐾",
  "Vampire":"🧛",
  "Smut":"🔥",
  "Fluff":"🧸",
  "Angst":"💔",
  "Horror":"🩸",
  "Comedy":"😂",
  "Enemies to Lovers":"⚔️",
  "Dead Dove":"🕊️",
  "Magical":"✨",
  "Historical":"📜",
  "Sci-Fi":"🚀",
  "Royalty":"👑",
  "Villain":"🦹",
  "Hero":"🦸",
  "RPG":"🎲",
  "Scenario":"🎭"
};

// Popular/commonly useful tags are intentionally placed first in the quick rail.
window.TAG_ORDER = [
  "Angst","Fluff","Smut","Dominant","Dead Dove","Enemies to Lovers","Demi-Human","Non-Human",
  "Horror","Historical","Royalty","Magical","Vampire","Switch","Submissive","Sci-Fi",
  "Multiple","Villain","Hero","Comedy","Game","Anime","RPG","Scenario"
];

window.BOTS = [
  {id:"matvey-kalinin",nameRu:"Матвей Калинин",nameEn:"Matvey Kalinin",author:"CrimsonGem",authorUrl:"https://example.com/@CrimsonGem",universe:"The Pace of Death",pov:"AnyPOV",tags:["Horror","Angst","Dead Dove","Multiple"],short:"Пятеро подростков украли лодку, чтобы увидеть затопленный город. Матвей — тот, кто уговорил остальных отправиться.",full:"После катастрофы город медленно уходит под воду, а оставшиеся районы отрезаны друг от друга. Матвей привык говорить так, будто всё под контролем, даже когда решение уже стало ошибкой.",image:"assets/bot-1.svg",platform:"JANITOR",url:"https://example.com/",download:"downloads/matvey-kalinin.json",isNew:true,lorebook:"downloads/matvey-kalinin-lorebook.json",intros:["Матвей первым нарушает тишину и предлагает маршрут к затопленному городу.","Лодка уже отошла от берега, когда Матвей замечает, что течение стало слишком сильным.","Матвей встречает вас у старого причала перед самым рассветом."]},
  {id:"arina-volkova",nameRu:"Арина Волкова",nameEn:"Arina Volkova",author:"NoxAstra",authorUrl:"https://example.com/@NoxAstra",universe:"Neon District",pov:"FemPOV",tags:["Sci-Fi","Villain","Angst"],short:"Арина чинит чужие импланты днём и продаёт запрещённые прошивки ночью. Одна ошибка связывает её с человеком, которого лучше было не встречать.",full:"В городе, где личность можно перепрошить почти так же легко, как телефон, Арина держит маленькую нелегальную мастерскую.",image:"assets/bot-2.svg",platform:"JANITOR",url:"https://example.com/",download:"downloads/arina-volkova.json",isNew:true,lorebook:null,intros:["Первая демонстрационная версия вступительного сообщения для этого персонажа."]},
  {id:"leo-hart",nameRu:"Лео Харт",nameEn:"Leo Hart",author:"VelvetStatic",authorUrl:"https://example.com/@VelvetStatic",universe:"Nocturne City",pov:"AnyPOV",tags:["Vampire","Magical","Horror"],short:"Лео владеет круглосуточным кинотеатром, в котором никогда не показывают премьер. Некоторые посетители приходят туда вовсе не ради фильмов.",full:"Старый кинотеатр пережил несколько владельцев, пожаров и реконструкций, но Лео будто не меняется вместе с ним.",image:"assets/bot-3.svg",platform:"JANITOR",url:"https://example.com/",download:"downloads/leo-hart.json",isNew:false,lorebook:"downloads/leo-hart-lorebook.json",intros:["Кинотеатр почти пуст, когда Лео замечает вас у закрытого зала.","После полуночи на афише появляется фильм, которого не существует."]},
  {id:"mira-seo",nameRu:"Мира Со",nameEn:"Mira Seo",author:"Lumen",authorUrl:"https://example.com/@Lumen",universe:"Afterglow",pov:"FemPOV",tags:["Fluff","Angst"],short:"Бывшая айдол возвращается в Сеул под чужим именем. Единственный человек, который узнаёт её сразу, — старый друг.",full:"После внезапного ухода со сцены Мира исчезла из публичной жизни. Спустя два года она возвращается, надеясь начать сначала.",image:"assets/bot-4.svg",platform:"JANITOR",url:"https://example.com/",download:"downloads/mira-seo.json",isNew:false,lorebook:null,intros:["Первая демонстрационная версия вступительного сообщения для этого персонажа.","Альтернативное вступительное сообщение для демонстрации переключения INTRO."]},
  {id:"cassian-vale",nameRu:"Кассиан Вейл",nameEn:"Cassian Vale",author:"CrimsonGem",authorUrl:"https://example.com/@CrimsonGem",universe:"Black Harbour",pov:"FemPOV",tags:["Dominant","Enemies to Lovers","Dead Dove","Villain"],short:"Кассиан привык покупать молчание, лояльность и время. Единственное, что ему не удаётся купить, — ваше согласие исчезнуть из его жизни.",full:"Black Harbour существует на контрактах, долгах и услугах, которые никогда не забываются.",image:"assets/bot-5.svg",platform:"JANITOR",url:"https://example.com/",download:"downloads/cassian-vale.json",isNew:true,lorebook:"downloads/cassian-vale-lorebook.json",intros:["Кассиан ждёт вас в пустом ресторане после закрытия.","Контракт лежит на столе, но Кассиан явно пришёл говорить не о нём.","Вы сталкиваетесь с Кассианом там, где его быть не должно."]},
  {id:"elias-reed",nameRu:"Элиас Рид",nameEn:"Elias Reed",author:"StaticBloom",authorUrl:"https://example.com/@StaticBloom",universe:"Small Town Static",pov:"AnyPOV",tags:["Fluff","Angst"],short:"Элиас держит автомастерскую на окраине и делает вид, что не помнит вашу последнюю встречу. Он помнит всё.",full:"Город маленький, слухи быстрые, а некоторые истории невозможно оставить в прошлом.",image:"assets/bot-6.svg",platform:"JANITOR",url:"https://example.com/",download:"downloads/elias-reed.json",isNew:false,lorebook:null,intros:["Первая демонстрационная версия вступительного сообщения для этого персонажа."]}
];
