const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');



const userRoutes = require('./routes/userRoutes');
const ticketRoutes = require('./routes/ticketRutes');
const aboutRoutes = require('./routes/aboutRoutes');
const blogRoutes = require('./routes/blogRoutes.js');
const faqRoutes = require('./routes/faqRoutes.js');
const desktopmastheadRoutes = require('./routes/desktopmastheadRoutes.js');
const mobilemastheadRoutes = require('./routes/mobilemastheadRoutes.js');
const sociallinkRoutes = require('./routes/sociallinkRoutes.js');
const ratingRoutes = require('./routes/ratingRoutes.js');
const myaddressRoutes = require('./routes/myaddressRoutes.js');
const mywishlistRoutes = require('./routes/mywishlistRoutes.js');
const myreferralRoutes = require('./routes/myreferralRoutes.js');
const mygiftcardRoutes = require('./routes/mygiftcardRoutes.js');
const mywalletRoutes = require('./routes/mywalletRoutes.js');
const cartRoutes = require('./routes/cartRoutes.js');
const contactusRoutes = require('./routes/contactusRoutes.js');
const pagesdataRoutes = require('./routes/pagesdataRoutes.js');
const savecardsRoutes = require('./routes/savecardsRoutes.js');
const othersRoutes = require('./routes/othersRoutes.js');
const categories_rawmasterRoutes = require('./routes/categories_rawmasterRoutes.js');
const resintype_rawmasterRoutes = require('./routes/resintype_rawmasterRoutes.js');
const shape_rawmasterRoutes = require('./routes/shape_rawmasterRoutes.js');
const sizeforshape_rawmasterRoutes = require('./routes/sizeforshape_rawmasterRoutes.js');
const bezelmaterial_rawmasterRoutes = require('./routes/bezelmaterial_rawmasterRoutes.js');
const bezelcolor_rawmasterRoutes = require('./routes/bezelcolor_rawmasterRoutes.js');
const innermaterial_rawmasterRoutes = require('./routes/innermaterial_rawmasterRoutes.js');
const flower_rawmasterRoutes = require('./routes/flower_rawmasterRoutes.js');
const colorshade_rawmasterRoutes = require('./routes/colorshade_rawmasterRoutes.js');
const customersRoutes = require('./routes/customersRoutes.js');
const frontendproductsRoutes = require('./routes/frontendproductsRoutes.js');
const collectionRoutes = require('./routes/collectionRoutes.js');
const emailRoutes = require('./routes/emailRoutes.js');
const packers_quality_packing = require('./routes/packers_quality_packing');

const warehouse_warehouse = require('./routes/warehouse_warehouse');
const warehouse_racks = require('./routes/warehouse_racks');
const warehouse_boxes = require('./routes/warehouse_boxes');
const reports = require('./routes/reports');
const report_links = require('./routes/report_links');
const manage_offline_sales = require('./routes/manage_offline_sales');
const manage_batches = require('./routes/manage_batches');
const manage_sales_reports = require('./routes/manage_sales_reports');
const manage_orders = require('./routes/manage_orders');
const manage_sell = require('./routes/manage_sell');
const manage_dashboard = require('./routes/manage_dashboard');
const inventory_lookup = require('./routes/inventory_lookup');

const AuthPortal = require('./routes/authPortal');
const ChannelPortal = require('./routes/channelPortal');
const CustomerPortal = require('./routes/customerportal');
const CampaignPortal = require('./routes/campaignPortal');
const designerPortal = require('./routes/designerPortal');
const marketingPortal = require('./routes/marketingPortal');
const packerPortal = require('./routes/packerPortal');
const UploadPortal = require('./routes/uploadtoazure');
const replicatorPortal = require('./routes/replicatorPortal');
const supportPortal = require('./routes/supportPortal');
const warehousePortal = require('./routes/warehousePortal');
const giftcardPortal = require('./routes/giftcardPortal');
const rolePortal = require('./routes/rolePortal');
const offlinesalesPortal = require('./routes/offlinesalesPortal');
const checkoutPortal = require('./routes/checkoutPortal');
const orderPortal = require('./routes/orderPortal');
const modulesPortal = require('./routes/modulesPortal');
const affiliatePortal = require('./routes/affiliatePortal');
const rawProductPortal = require('./routes/rawProductPortal');
const frontendcampaignPortal = require('./routes/frontendcampaignPortal');
const inventorycampaignPortal = require('./routes/inventoryPortal');
const managerequestPortal = require('./routes/managerequestPortal');

require('dotenv').config();

const app = express();
const bodyParser = require('body-parser');
const port = process.env.PORT || 3000;
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

const allowedOrigins = ['http://localhost:3000', 'http://localhost:3032', 'http://98.70.76.169:3033', 'http://localhost:3033'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,POST,PUT,DELETE',
  allowedHeaders: 'Content-Type,Authorization',
  exposedHeaders: 'Content-Length,X-Kuma-Revision',
  credentials: true,
  maxAge: 600
}));

const upload = multer(); 
app.use((req, res, next) => {
    // console.log(`Incoming request: ${req.method} ${req.url}`);
    // console.log(`Headers: ${JSON.stringify(req.headers)}`);
    next();
});

app.use((req, res, next) => {
  // console.log(`Incoming request: ${req.method} ${req.url}`);
  // console.log(`Headers: ${JSON.stringify(req.headers)}`);
  // console.log(`Body: ${JSON.stringify(req.body)}`);
  next();
});
app.use(bodyParser.json({ limit: '20mb' }));
app.use(bodyParser.urlencoded({ limit: '20mb', extended: true }));

app.use('/api/users', userRoutes);
app.use('/api/ticket', ticketRoutes);
app.use('/api/about', aboutRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/desktopmasthead', desktopmastheadRoutes);
app.use('/api/mobilemasthead', mobilemastheadRoutes);
app.use('/api/sociallink', sociallinkRoutes);
app.use('/api/rating', ratingRoutes);
app.use('/api/myaddress', myaddressRoutes);
app.use('/api/mywishlist', mywishlistRoutes);
app.use('/api/myreferral', myreferralRoutes);
app.use('/api/mygiftcard', mygiftcardRoutes);
app.use('/api/mywallet', mywalletRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/contactus', contactusRoutes);
app.use('/api/pagesdata', pagesdataRoutes);
app.use('/api/savecards', savecardsRoutes);
app.use('/api/others', othersRoutes);
app.use('/api/categories', categories_rawmasterRoutes);
app.use('/api/resintype', resintype_rawmasterRoutes);
app.use('/api/shape', shape_rawmasterRoutes);
app.use('/api/sizeforshape', sizeforshape_rawmasterRoutes);
app.use('/api/bezelmaterial', bezelmaterial_rawmasterRoutes);
app.use('/api/bezelcolor', bezelcolor_rawmasterRoutes);
app.use('/api/innermaterial', innermaterial_rawmasterRoutes);
app.use('/api/flower', flower_rawmasterRoutes);
app.use('/api/colorshade', colorshade_rawmasterRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/frontendproducts', frontendproductsRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/packers_quality_packing', packers_quality_packing);

app.use('/api/warehouse_warehouse', warehouse_warehouse);
app.use('/api/warehouse_racks', warehouse_racks);
app.use('/api/warehouse_boxes', warehouse_boxes);
app.use('/api/reports', reports);
app.use('/api/report_links', report_links);
app.use('/api/manage_offline_sales', manage_offline_sales);
app.use('/api/manage_batches', manage_batches);
app.use('/api/manage_sales_reports', manage_sales_reports);
app.use('/api/manage_orders', manage_orders);
app.use('/api/manage_sell', manage_sell);
app.use('/api/manage_dashboard', manage_dashboard);
app.use('/api/inventory_lookup', inventory_lookup);

app.use('/api/authportal', AuthPortal);
app.use('/api/channelassign', ChannelPortal);
app.use('/api/customers', CustomerPortal);
app.use('/api/campaign', CampaignPortal);
app.use('/api/designer', designerPortal);
app.use('/api/marketing', marketingPortal);
app.use('/api/uploadtoazure', UploadPortal);
app.use('/api/packers', packerPortal);
app.use('/api/replicator', replicatorPortal);
app.use('/api/supportchannel', supportPortal);
app.use('/api/warehouse', warehousePortal);
app.use('/api/giftcard', giftcardPortal);
app.use('/api/role', rolePortal);
app.use('/api/offlinesales', offlinesalesPortal);
app.use('/api/checkout', checkoutPortal);
app.use('/api/orders', orderPortal);
app.use('/api/modules', modulesPortal);
app.use('/api/affiliate', affiliatePortal);
app.use('/api/fetchrawproducts', rawProductPortal);
app.use('/api/frontendcampaignlist', frontendcampaignPortal);
app.use('/api/inventory', inventorycampaignPortal);
app.use('/api/managerequest', managerequestPortal);



app.listen(port, () => {
  console.log(`Server running on ${process.env.NEXT_PUBLIC_API_URL}`);
});