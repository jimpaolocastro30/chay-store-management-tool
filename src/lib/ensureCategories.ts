import { Category } from "@/models/Category";
import { PRODUCT_CATEGORIES } from "@/lib/categories";

export async function ensureDefaultCategories() {
  const count = await Category.countDocuments();
  if (count > 0) return;

  await Category.insertMany(
    PRODUCT_CATEGORIES.map((name, index) => ({
      name,
      sortOrder: (index + 1) * 10,
    }))
  );
}