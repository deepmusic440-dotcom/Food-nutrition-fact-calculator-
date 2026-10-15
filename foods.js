// Built-in food database. Values are per 100 g, approximated from USDA FoodData Central.
// Columns: name, category, kcal, protein g, carbs g, fat g, fiber g, sugars g,
//          saturated fat g, cholesterol mg, sodium mg, serving label, serving grams
const FOOD_ROWS = [
  // Fruits
  ["Apple, raw", "Fruit", 52, 0.3, 13.8, 0.2, 2.4, 10.4, 0, 0, 1, "1 medium", 182],
  ["Banana, raw", "Fruit", 89, 1.1, 22.8, 0.3, 2.6, 12.2, 0.1, 0, 1, "1 medium", 118],
  ["Orange, raw", "Fruit", 47, 0.9, 11.8, 0.1, 2.4, 9.4, 0, 0, 0, "1 medium", 131],
  ["Strawberries, raw", "Fruit", 32, 0.7, 7.7, 0.3, 2.0, 4.9, 0, 0, 1, "1 cup", 152],
  ["Blueberries, raw", "Fruit", 57, 0.7, 14.5, 0.3, 2.4, 10.0, 0, 0, 1, "1 cup", 148],
  ["Grapes, raw", "Fruit", 69, 0.7, 18.1, 0.2, 0.9, 15.5, 0.1, 0, 2, "1 cup", 151],
  ["Avocado, raw", "Fruit", 160, 2.0, 8.5, 14.7, 6.7, 0.7, 2.1, 0, 7, "1/2 fruit", 75],
  ["Mango, raw", "Fruit", 60, 0.8, 15.0, 0.4, 1.6, 13.7, 0.1, 0, 1, "1 cup pieces", 165],
  ["Pineapple, raw", "Fruit", 50, 0.5, 13.1, 0.1, 1.4, 9.9, 0, 0, 1, "1 cup chunks", 165],
  ["Watermelon, raw", "Fruit", 30, 0.6, 7.6, 0.2, 0.4, 6.2, 0, 0, 1, "1 cup diced", 152],
  ["Pear, raw", "Fruit", 57, 0.4, 15.2, 0.1, 3.1, 9.8, 0, 0, 1, "1 medium", 178],
  ["Peach, raw", "Fruit", 39, 0.9, 9.5, 0.3, 1.5, 8.4, 0, 0, 0, "1 medium", 150],
  ["Raisins", "Fruit", 299, 3.1, 79.2, 0.5, 3.7, 59.2, 0.1, 0, 11, "1/4 cup", 40],

  // Vegetables
  ["Broccoli, raw", "Vegetables", 34, 2.8, 6.6, 0.4, 2.6, 1.7, 0, 0, 33, "1 cup chopped", 91],
  ["Spinach, raw", "Vegetables", 23, 2.9, 3.6, 0.4, 2.2, 0.4, 0.1, 0, 79, "1 cup", 30],
  ["Kale, raw", "Vegetables", 35, 2.9, 4.4, 1.5, 4.1, 1.0, 0.2, 0, 53, "1 cup chopped", 21],
  ["Carrot, raw", "Vegetables", 41, 0.9, 9.6, 0.2, 2.8, 4.7, 0, 0, 69, "1 medium", 61],
  ["Tomato, raw", "Vegetables", 18, 0.9, 3.9, 0.2, 1.2, 2.6, 0, 0, 5, "1 medium", 123],
  ["Cucumber, raw", "Vegetables", 15, 0.7, 3.6, 0.1, 0.5, 1.7, 0, 0, 2, "1 cup sliced", 104],
  ["Romaine lettuce", "Vegetables", 17, 1.2, 3.3, 0.3, 2.1, 1.2, 0, 0, 8, "1 cup shredded", 47],
  ["Bell pepper, red", "Vegetables", 31, 1.0, 6.0, 0.3, 2.1, 4.2, 0, 0, 4, "1 medium", 119],
  ["Onion, raw", "Vegetables", 40, 1.1, 9.3, 0.1, 1.7, 4.2, 0, 0, 4, "1 medium", 110],
  ["Potato, baked with skin", "Vegetables", 93, 2.5, 21.2, 0.1, 2.2, 1.2, 0, 0, 10, "1 medium", 173],
  ["Sweet potato, baked", "Vegetables", 90, 2.0, 20.7, 0.2, 3.3, 6.5, 0, 0, 36, "1 medium", 114],
  ["Sweet corn, cooked", "Vegetables", 96, 3.4, 21.0, 1.5, 2.4, 4.5, 0.2, 0, 1, "1 ear", 103],
  ["Green peas, cooked", "Vegetables", 84, 5.4, 15.6, 0.2, 5.5, 5.9, 0, 0, 3, "1 cup", 160],
  ["Green beans, cooked", "Vegetables", 35, 1.9, 7.9, 0.3, 3.2, 3.6, 0.1, 0, 1, "1 cup", 125],
  ["Mushrooms, white, raw", "Vegetables", 22, 3.1, 3.3, 0.3, 1.0, 2.0, 0, 0, 5, "1 cup sliced", 70],
  ["Cauliflower, raw", "Vegetables", 25, 1.9, 5.0, 0.3, 2.0, 1.9, 0.1, 0, 30, "1 cup chopped", 107],
  ["Zucchini, raw", "Vegetables", 17, 1.2, 3.1, 0.3, 1.0, 2.5, 0.1, 0, 8, "1 medium", 196],
  ["Marinara sauce", "Vegetables", 50, 1.4, 8.0, 1.5, 1.8, 5.4, 0.2, 0, 437, "1/2 cup", 125],

  // Grains & bread
  ["White rice, cooked", "Grains", 130, 2.7, 28.2, 0.3, 0.4, 0.1, 0.1, 0, 1, "1 cup", 158],
  ["Brown rice, cooked", "Grains", 123, 2.7, 25.6, 1.0, 1.6, 0.2, 0.2, 0, 4, "1 cup", 195],
  ["Pasta, cooked", "Grains", 158, 5.8, 30.9, 0.9, 1.8, 0.6, 0.2, 0, 1, "1 cup", 140],
  ["Quinoa, cooked", "Grains", 120, 4.4, 21.3, 1.9, 2.8, 0.9, 0.2, 0, 7, "1 cup", 185],
  ["Rolled oats, dry", "Grains", 379, 13.2, 67.7, 6.5, 10.1, 1.0, 1.1, 0, 6, "1/2 cup", 40],
  ["Oatmeal, cooked with water", "Grains", 71, 2.5, 12.0, 1.5, 1.7, 0.3, 0.3, 0, 4, "1 cup", 234],
  ["Whole wheat bread", "Grains", 252, 12.4, 42.7, 3.5, 6.0, 4.4, 0.7, 0, 450, "1 slice", 32],
  ["White bread", "Grains", 266, 7.6, 50.6, 3.3, 2.4, 5.7, 0.7, 0, 491, "1 slice", 28],
  ["Bagel, plain", "Grains", 257, 10.1, 50.5, 1.6, 2.1, 5.1, 0.2, 0, 439, "1 medium", 105],
  ["Flour tortilla", "Grains", 304, 8.2, 50.0, 7.6, 3.5, 2.2, 2.9, 0, 617, "1 medium (8 in)", 45],
  ["Corn tortilla", "Grains", 218, 5.7, 44.6, 2.9, 6.3, 0.9, 0.3, 0, 45, "1 tortilla", 26],
  ["Corn flakes cereal", "Grains", 357, 7.5, 84.1, 0.4, 3.3, 9.6, 0.1, 0, 729, "1 cup", 28],
  ["Granola", "Grains", 471, 10.5, 64.4, 20.3, 5.3, 24.4, 3.8, 0, 26, "1/2 cup", 61],
  ["Popcorn, air-popped", "Grains", 387, 12.9, 77.8, 4.5, 14.5, 0.9, 0.6, 0, 8, "1 cup", 8],
  ["Saltine crackers", "Grains", 421, 9.5, 74.0, 8.6, 2.9, 1.4, 2.0, 0, 950, "5 crackers", 15],

  // Meat, fish, eggs
  ["Chicken breast, roasted, skinless", "Protein", 165, 31.0, 0, 3.6, 0, 0, 1.0, 85, 74, "3 oz", 85],
  ["Chicken thigh, roasted, skinless", "Protein", 179, 24.8, 0, 8.2, 0, 0, 2.3, 130, 95, "1 thigh", 70],
  ["Ground beef 85% lean, cooked", "Protein", 250, 25.9, 0, 15.4, 0, 0, 5.9, 89, 72, "3 oz", 85],
  ["Sirloin steak, broiled", "Protein", 206, 29.7, 0, 8.8, 0, 0, 3.4, 89, 60, "3 oz", 85],
  ["Pork chop, broiled", "Protein", 231, 25.7, 0, 13.6, 0, 0, 4.8, 79, 62, "1 chop", 145],
  ["Bacon, cooked", "Protein", 541, 37.0, 1.4, 42.0, 0, 0, 14.0, 110, 1717, "1 slice", 8],
  ["Ham, deli sliced", "Protein", 145, 21.0, 1.5, 6.0, 0, 0, 2.0, 53, 1200, "1 slice", 28],
  ["Turkey breast, deli sliced", "Protein", 104, 17.1, 4.2, 1.7, 0.5, 3.5, 0.5, 43, 1015, "1 slice", 28],
  ["Salmon, Atlantic, cooked", "Protein", 206, 22.1, 0, 12.4, 0, 0, 2.5, 63, 61, "3 oz", 85],
  ["Tuna, canned in water", "Protein", 116, 25.5, 0, 0.8, 0, 0, 0.2, 30, 247, "3 oz", 85],
  ["Shrimp, cooked", "Protein", 99, 24.0, 0.2, 0.3, 0, 0, 0.1, 189, 111, "3 oz", 85],
  ["Cod, cooked", "Protein", 105, 22.8, 0, 0.9, 0, 0, 0.2, 55, 78, "3 oz", 85],
  ["Egg, whole, raw", "Protein", 143, 12.6, 0.7, 9.5, 0, 0.4, 3.1, 372, 142, "1 large", 50],
  ["Egg, hard-boiled", "Protein", 155, 12.6, 1.1, 10.6, 0, 1.1, 3.3, 373, 124, "1 large", 50],
  ["Egg white, raw", "Protein", 52, 10.9, 0.7, 0.2, 0, 0.7, 0, 0, 166, "1 large", 33],
  ["Whey protein powder", "Protein", 400, 80.0, 8.0, 6.0, 0, 5.0, 3.0, 150, 200, "1 scoop", 30],

  // Plant protein, nuts & seeds
  ["Tofu, firm", "Plant protein", 144, 17.3, 2.8, 8.7, 2.3, 0.6, 1.3, 0, 14, "1/2 cup", 126],
  ["Lentils, cooked", "Plant protein", 116, 9.0, 20.1, 0.4, 7.9, 1.8, 0.1, 0, 2, "1 cup", 198],
  ["Black beans, cooked", "Plant protein", 132, 8.9, 23.7, 0.5, 8.7, 0.3, 0.1, 0, 1, "1 cup", 172],
  ["Chickpeas, cooked", "Plant protein", 164, 8.9, 27.4, 2.6, 7.6, 4.8, 0.3, 0, 7, "1 cup", 164],
  ["Kidney beans, cooked", "Plant protein", 127, 8.7, 22.8, 0.5, 6.4, 0.3, 0.1, 0, 2, "1 cup", 177],
  ["Hummus", "Plant protein", 166, 7.9, 14.3, 9.6, 6.0, 0.3, 1.4, 0, 379, "2 tbsp", 30],
  ["Peanut butter", "Plant protein", 588, 25.0, 20.0, 50.0, 6.0, 9.2, 10.3, 0, 430, "2 tbsp", 32],
  ["Almonds", "Plant protein", 579, 21.2, 21.6, 49.9, 12.5, 4.4, 3.8, 0, 1, "1 oz", 28],
  ["Walnuts", "Plant protein", 654, 15.2, 13.7, 65.2, 6.7, 2.6, 6.1, 0, 2, "1 oz", 28],
  ["Peanuts, dry roasted", "Plant protein", 567, 25.8, 16.1, 49.2, 8.5, 4.7, 6.3, 0, 18, "1 oz", 28],
  ["Cashews", "Plant protein", 553, 18.2, 30.2, 43.9, 3.3, 5.9, 7.8, 0, 12, "1 oz", 28],
  ["Chia seeds", "Plant protein", 486, 16.5, 42.1, 30.7, 34.4, 0, 3.3, 0, 16, "1 tbsp", 12],
  ["Sunflower seeds", "Plant protein", 584, 20.8, 20.0, 51.5, 8.6, 2.6, 4.5, 0, 9, "1 oz", 28],

  // Dairy
  ["Milk, whole", "Dairy", 61, 3.2, 4.8, 3.3, 0, 5.1, 1.9, 10, 43, "1 cup", 244],
  ["Milk, 2%", "Dairy", 50, 3.3, 4.8, 2.0, 0, 5.1, 1.3, 8, 47, "1 cup", 244],
  ["Milk, skim", "Dairy", 34, 3.4, 5.0, 0.1, 0, 5.1, 0.1, 2, 42, "1 cup", 245],
  ["Greek yogurt, plain, nonfat", "Dairy", 59, 10.2, 3.6, 0.4, 0, 3.2, 0.1, 5, 36, "1 container", 170],
  ["Yogurt, plain, whole milk", "Dairy", 61, 3.5, 4.7, 3.3, 0, 4.7, 2.1, 13, 46, "1 cup", 245],
  ["Cheddar cheese", "Dairy", 403, 24.9, 1.3, 33.1, 0, 0.5, 21.1, 105, 621, "1 oz", 28],
  ["Mozzarella, part-skim", "Dairy", 254, 24.3, 2.8, 15.9, 0, 1.1, 10.1, 64, 619, "1 oz", 28],
  ["Parmesan, grated", "Dairy", 431, 38.5, 4.1, 28.6, 0, 0.9, 17.3, 88, 1529, "1 tbsp", 5],
  ["Cottage cheese, 2%", "Dairy", 81, 10.5, 4.8, 2.3, 0, 4.0, 1.2, 12, 308, "1/2 cup", 113],
  ["Cream cheese", "Dairy", 342, 5.9, 4.1, 34.2, 0, 3.2, 19.3, 110, 321, "1 tbsp", 15],
  ["Butter, salted", "Dairy", 717, 0.9, 0.1, 81.1, 0, 0.1, 51.4, 215, 643, "1 tbsp", 14],
  ["Ice cream, vanilla", "Dairy", 207, 3.5, 23.6, 11.0, 0.7, 21.2, 6.8, 44, 80, "1/2 cup", 66],

  // Fats, sweeteners, condiments
  ["Olive oil", "Condiments", 884, 0, 0, 100, 0, 0, 13.8, 0, 2, "1 tbsp", 14],
  ["Canola oil", "Condiments", 884, 0, 0, 100, 0, 0, 7.4, 0, 0, "1 tbsp", 14],
  ["Mayonnaise", "Condiments", 680, 1.0, 0.6, 74.9, 0, 0.6, 11.7, 42, 635, "1 tbsp", 14],
  ["Ketchup", "Condiments", 101, 1.0, 27.4, 0.1, 0.3, 22.8, 0, 0, 907, "1 tbsp", 17],
  ["Mustard, yellow", "Condiments", 60, 3.7, 5.8, 3.3, 4.0, 0.9, 0.2, 0, 1104, "1 tsp", 5],
  ["Soy sauce", "Condiments", 53, 8.1, 4.9, 0.6, 0.8, 0.4, 0.1, 0, 5493, "1 tbsp", 16],
  ["Salsa", "Condiments", 36, 1.5, 6.6, 0.2, 1.8, 4.0, 0, 0, 600, "2 tbsp", 32],
  ["Ranch dressing", "Condiments", 430, 1.3, 5.9, 44.5, 0, 4.7, 6.9, 26, 901, "2 tbsp", 30],
  ["Honey", "Condiments", 304, 0.3, 82.4, 0, 0.2, 82.1, 0, 0, 4, "1 tbsp", 21],
  ["Maple syrup", "Condiments", 260, 0, 67.0, 0.1, 0, 60.5, 0, 0, 12, "1 tbsp", 20],
  ["Sugar, granulated", "Condiments", 387, 0, 100, 0, 0, 100, 0, 0, 1, "1 tsp", 4],
  ["Jam / preserves", "Condiments", 278, 0.4, 68.9, 0.1, 1.1, 48.5, 0, 0, 32, "1 tbsp", 20],

  // Drinks
  ["Coffee, black", "Drinks", 1, 0.1, 0, 0, 0, 0, 0, 0, 2, "1 cup", 237],
  ["Orange juice", "Drinks", 45, 0.7, 10.4, 0.2, 0.2, 8.4, 0, 0, 1, "1 cup", 248],
  ["Apple juice", "Drinks", 46, 0.1, 11.3, 0.1, 0.2, 9.6, 0, 0, 4, "1 cup", 248],
  ["Cola", "Drinks", 42, 0, 10.6, 0, 0, 9.0, 0, 0, 4, "1 can (12 fl oz)", 368],
  ["Sports drink", "Drinks", 26, 0, 6.4, 0, 0, 5.6, 0, 0, 41, "1 bottle (20 fl oz)", 591],
  ["Almond milk, unsweetened", "Drinks", 15, 0.6, 0.6, 1.2, 0.2, 0, 0.1, 0, 72, "1 cup", 240],
  ["Oat milk", "Drinks", 50, 1.25, 6.7, 2.1, 0.8, 2.9, 0.2, 0, 42, "1 cup", 240],
  ["Beer, regular", "Drinks", 43, 0.5, 3.6, 0, 0, 0, 0, 0, 4, "1 can (12 fl oz)", 356],
  ["Red wine", "Drinks", 85, 0.1, 2.6, 0, 0, 0.6, 0, 0, 4, "1 glass (5 fl oz)", 147],

  // Snacks & prepared
  ["Dark chocolate, 70-85%", "Snacks", 598, 7.8, 45.9, 42.6, 10.9, 24.0, 24.5, 3, 20, "1 oz", 28],
  ["Milk chocolate", "Snacks", 535, 7.7, 59.4, 29.7, 3.4, 51.5, 18.5, 23, 79, "1 bar", 44],
  ["Potato chips", "Snacks", 536, 7.0, 53.0, 34.6, 4.4, 0.3, 3.1, 0, 525, "1 oz", 28],
  ["Tortilla chips", "Snacks", 489, 6.6, 65.0, 23.4, 5.3, 1.0, 2.6, 0, 410, "1 oz", 28],
  ["Pretzels", "Snacks", 380, 10.3, 79.8, 2.6, 2.8, 2.8, 0.4, 0, 1240, "1 oz", 28],
  ["Protein bar", "Snacks", 350, 33.0, 37.0, 12.0, 8.0, 5.0, 4.0, 10, 300, "1 bar", 60],
  ["Cheese pizza", "Snacks", 266, 11.4, 33.3, 9.7, 2.3, 3.6, 4.5, 17, 598, "1 slice", 107],
  ["Cheeseburger, fast food", "Snacks", 252, 12.6, 27.7, 10.9, 1.7, 5.9, 4.2, 34, 605, "1 burger", 119],
  ["French fries, fast food", "Snacks", 312, 3.4, 41.4, 14.7, 3.8, 0.3, 2.3, 0, 210, "1 medium order", 117],
];

const NUTRIENT_KEYS = ["kcal", "pro", "carb", "fat", "fib", "sug", "sat", "chol", "na"];

const BUILTIN_FOODS = FOOD_ROWS.map((r) => {
  const per100 = {};
  NUTRIENT_KEYS.forEach((k, i) => (per100[k] = r[2 + i]));
  return {
    id: "b:" + r[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name: r[0],
    cat: r[1],
    per100,
    serving: { label: r[11], g: r[12] },
    source: "builtin",
  };
});
