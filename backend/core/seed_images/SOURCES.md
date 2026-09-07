# Catalogue photos

One JPEG per catalogue SKU, named for the item code, 800x800. `seed_demo` and
`attach_product_images` copy these into `MEDIA_ROOT/products/` and point each
`Product.image` at the copy.

Every image is Heritage Foods Limited's own published photography of its own
products, taken from `heritagefoods.in` and squared onto a white ground (the
food photography for shrikhand and amrakhand is centre-cropped instead). They
are **Heritage's copyright**, used here to make a college demo of a Heritage
price list look like the shop it describes. This repo is private and the images
are not licensed for redistribution — if DairyDesk is ever published or shown
commercially, replace them or get permission first.

## Where each one came from

Base for the packshots: `https://www.heritagefoods.in/static/images/detailslider/`

| SKUs | Source file |
| --- | --- |
| 10913, 10914, 10932 Golden Cow Milk | `milk/cow-milk.png` |
| 10519, 10521, 10561 Toned Milk | `milk/tonemilk.png` |
| 10613, 10614 Standardised Milk | `milk/standardized-milk.png` |
| 10833, 10834 A2 Milk | `milk/a2-milk-front-new.png` |
| 10104, 10105, 10139, 10173, 10188 Curd sachets | `curd/curd.png`, sachets cropped out |
| 20012, 20068 Curd cups | `curd/curd.png`, cups cropped out |
| 20013 Curd family cup | `curd/curd.png`, tub cropped out |
| 10033 Plain Buttermilk | `buttermilk/buttermilk-plain.png` |
| 10042 Probiotic Buttermilk | `buttermilk/buttermilk-group.png`, sachet cropped out |
| 31217 Spiced Buttermilk | `buttermilk/buttermilk-group.png` |
| 20535 Sweet Lassi | `lassi/Detail-Page.png` |
| 20536 Mango Lassi | `mega/mango-lassi.png` |
| 20537 Strawberry Lassi | `lassi/Lassi-Strawberry.png` |
| 20601, 20602 Shrikhand Kesar | `blog/wp-content/uploads/2021/08/heritage-srikand.jpg` |
| 20651, 20652 Amrakhand | `blog/wp-content/uploads/2021/08/Amrakhand.jpg` |
| 20411 Paneer | `paneer/paneer-fresh.png` |
| 30707, 30715 Badam | `fmilk/livo-fmilk-badam.png` |
| 30744, 30748 Pista | `fmilk/livo-fmilk-pista.png` |
| 30764 Strawberry | `fmilk/livo-fmilk-strawberry.png` |
| 30754 Chocolate | `fmilk/fmilk-chocolate.png` |
| 30723 Vanilla | `fmilk/fmilk-vanilla.png` |
| 30793 Badam Charger | `fmilk/fmilk-bcharger.png` |
| 30787 Cold Coffee | `coldcoffee/coldcoffee.png` |
| 31215 Milkshake Chocolate | `milkshake/chocky.png` |
| 31216 Milkshake Cookies & Cream | `milkshake/cookie.png` |
| 31225 Milkshake Strawberry | `milkshake/milk-shake-strawberry.png` |
| 31235 Milkshake Vanilla | `milkshake/milk-shake-vanilla.png` |
| 21102 Gluco Shakti Orange | `energy-drink/gluco-shakti.png` |
| 71005 Farm Fresh UHT Milk | `milk/farm-fresh-milk-big.png` |
| 30234, 30235, 30252, 30254, 30255 Cow Ghee | `ghee/cow-ghee1.png` |
| 30334, 30335 Buffalo Ghee | `ghee/buffalo-ghee.png` |
| 73000 Cheese Slices 100 g | `processedcheeseslice/chees-slice-img.png`, one pack cropped out |
| 73001 Cheese Slices 200 g | `processedcheeseslice/chees-slice-img.png` |
| 73003 Cheese Cubes 200 g | `processedcheese/cheese-cube-img.png` |
| 73004 Cheese Cubes 120 g | `processedcheese/processedcheese.png`, cubes cropped out |
| 73005 Cheese Block | `processedcheese/processedcheese.png`, block cropped out |
| 20133, 20134 Table Butter | `butter/butter-premium.png` |

## Where the photo is not the exact pack

Heritage publishes one photo per line, not per pack size, so sizes of the same
product share a photo — the 500 ml and 1 L toned milk sachets are the same
picture, as are the five cow ghee packs. Beyond that, four rows are the nearest
Heritage product rather than the item itself, because Heritage publishes no
photo of the item:

- **10042 Probiotic Buttermilk** — the A-one *spiced* buttermilk sachet.
- **10139 Double Toned Curd** — the standard curd sachet.
- **20601, 20602 Shrikhand Kesar** and **20651, 20652 Amrakhand** — Heritage's
  own dish photography from its launch posts, not a shot of the cup.
