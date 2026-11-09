import { FarmerAccount, ProduceItem } from '../types/agriculture';

/** Returns only a product demonstrably owned by the selected farmer. */
export function getFarmerProduce(
  farmer: FarmerAccount,
  produceList: ProduceItem[]
): ProduceItem | undefined {
  return produceList.find((product) => ownsProduct(farmer, product));
}

export function ownsProduct(farmer: FarmerAccount, product: ProduceItem): boolean {
  if (product.ownerId) return product.ownerId === farmer.id;
  const farmerName = farmer.name.trim().toLocaleLowerCase('vi-VN');
  const farmerCode = farmer.pucCode.trim().toLocaleLowerCase('vi-VN');
  if (!farmerName && !farmerCode) return false;
    const profileName = product.farmerProfile?.name?.trim().toLocaleLowerCase('vi-VN');
    const listingFarmer = product.farmer.trim().toLocaleLowerCase('vi-VN');
    const productCode = product.vietgapCode.trim().toLocaleLowerCase('vi-VN');
    return Boolean((farmerName && (profileName === farmerName || listingFarmer === farmerName || listingFarmer.startsWith(`${farmerName} (`))) || (farmerCode && productCode === farmerCode));
}
