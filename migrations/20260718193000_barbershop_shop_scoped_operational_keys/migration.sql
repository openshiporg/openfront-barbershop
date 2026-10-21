-- Merchant identifiers may repeat across shops but remain unique within one shop.
DROP INDEX "BarberChair_chairNumber_key";
DROP INDEX "InventoryLot_lotNumber_key";
DROP INDEX "Product_sku_key";

CREATE INDEX "BarberChair_chairNumber_idx" ON "BarberChair"("chairNumber");
CREATE UNIQUE INDEX "BarberChair_shop_chairNumber_key" ON "BarberChair"("shop", "chairNumber");
CREATE INDEX "InventoryLot_lotNumber_idx" ON "InventoryLot"("lotNumber");
CREATE UNIQUE INDEX "InventoryLot_shop_lotNumber_key" ON "InventoryLot"("shop", "lotNumber");
CREATE INDEX "Product_sku_idx" ON "Product"("sku");
CREATE UNIQUE INDEX "Product_shop_sku_key" ON "Product"("shop", "sku");
