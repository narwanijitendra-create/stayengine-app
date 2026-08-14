// Curated, free-to-use food photos (Wikimedia Commons) that hotel owners can
// pick from when adding a menu item, instead of hunting for their own image URL.
// Each `url` is a stable, hotlinkable Wikimedia thumbnail.

export type StockPhoto = {
  label: string;
  url: string;
  category: string;
};

export const STOCK_FOOD_PHOTOS: StockPhoto[] = [
  // Breakfast
  { label: "Full breakfast", category: "Breakfast", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Full_English_breakfast_%28cropped%29.jpg/480px-Full_English_breakfast_%28cropped%29.jpg" },
  { label: "Pancakes", category: "Breakfast", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Foodiesfeed.com_pouring-honey-on-pancakes-with-walnuts.jpg/480px-Foodiesfeed.com_pouring-honey-on-pancakes-with-walnuts.jpg" },
  { label: "Waffles", category: "Breakfast", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Waffles_with_Strawberries.jpg/480px-Waffles_with_Strawberries.jpg" },
  { label: "Croissant", category: "Breakfast", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Croissant-Petr_Kratochvil.jpg/480px-Croissant-Petr_Kratochvil.jpg" },
  { label: "Doughnut", category: "Breakfast", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Glazed-Donut.jpg/480px-Glazed-Donut.jpg" },

  // Starters & snacks
  { label: "Spring rolls", category: "Starters", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Spring_Rolls_%283357696061%29.jpg/480px-Spring_Rolls_%283357696061%29.jpg" },
  { label: "Falafel", category: "Starters", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Falafels_2.jpg/480px-Falafels_2.jpg" },
  { label: "Momos", category: "Starters", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Momo_nepal.jpg/480px-Momo_nepal.jpg" },
  { label: "Paneer tikka", category: "Starters", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Paneer_tikka.jpg/480px-Paneer_tikka.jpg" },
  { label: "French fries", category: "Starters", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/French_Fries.JPG/480px-French_Fries.JPG" },
  { label: "Grilled cheese sandwich", category: "Starters", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Classic_Grilled_Cheese_Sandwich_%2825791331763%29_%28cropped%29.jpg/480px-Classic_Grilled_Cheese_Sandwich_%2825791331763%29_%28cropped%29.jpg" },

  // Soups & salads
  { label: "Chicken soup", category: "Soups & salads", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Chicken_Noodle_Soup.jpg/480px-Chicken_Noodle_Soup.jpg" },
  { label: "Green salad", category: "Soups & salads", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Salad_platter.jpg/480px-Salad_platter.jpg" },

  // Main course
  { label: "Pizza", category: "Main course", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Pizza-3007395.jpg/480px-Pizza-3007395.jpg" },
  { label: "Burger", category: "Main course", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/RedDot_Burger.jpg/480px-RedDot_Burger.jpg" },
  { label: "Pasta", category: "Main course", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/%28Pasta%29_by_David_Adam_Kess_%28pic.2%29.jpg/480px-%28Pasta%29_by_David_Adam_Kess_%28pic.2%29.jpg" },
  { label: "Butter chicken", category: "Main course", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Butter_Chicken_%26_Butter_Naan_-_Home_-_Chandigarh_-_India_-_0006.jpg/480px-Butter_Chicken_%26_Butter_Naan_-_Home_-_Chandigarh_-_India_-_0006.jpg" },
  { label: "Tandoori chicken", category: "Main course", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Chickentandoori.jpg/480px-Chickentandoori.jpg" },
  { label: "Biryani", category: "Main course", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/%22Hyderabadi_Dum_Biryani%22.jpg/480px-%22Hyderabadi_Dum_Biryani%22.jpg" },
  { label: "Dal makhani", category: "Main course", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Punjabi_style_Dal_Makhani.jpg/480px-Punjabi_style_Dal_Makhani.jpg" },
  { label: "Fried rice", category: "Main course", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Koh_Mak%2C_Thailand%2C_Fried_rice_with_seafood%2C_Thai_fried_rice.jpg/480px-Koh_Mak%2C_Thailand%2C_Fried_rice_with_seafood%2C_Thai_fried_rice.jpg" },
  { label: "Fried chicken", category: "Main course", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Fried-Chicken-Set.jpg/480px-Fried-Chicken-Set.jpg" },
  { label: "Fish and chips", category: "Main course", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Fish_and_chips_blackpool.jpg/480px-Fish_and_chips_blackpool.jpg" },
  { label: "Steak", category: "Main course", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Steak_frites_-_yummy.jpg/480px-Steak_frites_-_yummy.jpg" },
  { label: "Sushi platter", category: "Main course", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Sushi_platter.jpg/480px-Sushi_platter.jpg" },

  // Breads
  { label: "Naan", category: "Breads", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Annapurna_Naan.jpg/480px-Annapurna_Naan.jpg" },

  // Desserts
  { label: "Chocolate cake", category: "Desserts", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Chocolate_fudge_cake.jpg/480px-Chocolate_fudge_cake.jpg" },
  { label: "Ice cream", category: "Desserts", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Ice_cream_with_whipped_cream%2C_chocolate_syrup%2C_and_a_wafer_%28cropped%29.jpg/480px-Ice_cream_with_whipped_cream%2C_chocolate_syrup%2C_and_a_wafer_%28cropped%29.jpg" },

  // Beverages
  { label: "Coffee", category: "Beverages", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Latte_and_dark_coffee.jpg/480px-Latte_and_dark_coffee.jpg" },
  { label: "Orange juice", category: "Beverages", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Orangejuice.jpg/480px-Orangejuice.jpg" },
  { label: "Masala chai", category: "Beverages", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Chai_In_Sakora.jpg/480px-Chai_In_Sakora.jpg" },
  { label: "Milkshake", category: "Beverages", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Strawberry_milk_shake_%28cropped%29.jpg/480px-Strawberry_milk_shake_%28cropped%29.jpg" },
  { label: "Cocktail", category: "Beverages", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/15-09-26-RalfR-WLC-0084.jpg/480px-15-09-26-RalfR-WLC-0084.jpg" },
];
