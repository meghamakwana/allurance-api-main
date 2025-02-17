const TABLES = {

  // Reports
  REPORT_LINKS: 'report_links',
  OFFLINE_SALES_SERIAL_NUMBER: 'ine_offline_sales_serial_number',
  // Warehouse
  WAREHOUSE_WAREHOUSE: 'warehouse',
  WAREHOUSE_RACKS: 'warehouse_racks',
  WAREHOUSE_BOXES: 'warehouse_boxes',
  WAREHOUSE_BOXES_DATA: 'warehouse_boxes_data',

  // Serial Number
  PACKERS_SERIAL_NUMBER: 'serial_number',
  PACKERS_QUALITY: 'packers_quality',
  PACKERS_PACKING: 'packers_packing',
  
  // User Module
  USERS: 'ine_users',
  TEMP_USERS: 'ine_temp_user',
  USERS_MODULE_ID: 13,
  USERS_DETAILS: 'ine_users_details',
  CUSTOMER_MODULE_ID: 14,
  
  // Role Module
  ROLE: 'ine_roles',

  // Ticket Module
  TICKET: 'ine_tickets',
  TICKET_SUBJECT: 'ine_ticket_subject',
  TICKET_NEW_USER: 'ine_ticket_new_users',
  TICKET_RESPONSE: 'ine_ticket_response',
  TICKET_MODULE_ID: 9,

  // About Module
  ABOUT: 'ine_about_us',
  ABOUT_MODULE_ID: 0,

  // Blog Module
  BLOG: 'ine_blogs',
  BLOG_MODULE_ID: 0,
  BLOG_CATEGORY: 'ine_blog_category',
  BLOG_CATEGORY_MODULE_ID: 140,

  // Faq Module
  FAQ: 'ine_faqs',
  FAQ_MODULE_ID: 0,

  // Desktop Module
  DESKTOP_MASTHEAD: 'ine_desktop_masthead',
  DESKTOP_MASTHEAD_MODULE_ID: 0,

  // Mobile Module
  MOBILE_MASTHEAD: 'ine_mobile_masthead',
  MOBILE_MASTHEAD_MODULE_ID: 0,

  // Social Module
  SOCIAL: 'ine_social_links',
  SOCIAL_MODULE_ID: 136,

  // Rating Module
  RATING: 'ine_rating',
  RATING_MODULE_ID: 0,

  // Product Module
  // PRODUCT: 'ine_products',
  PRODUCT: 'ine_marketing',
  PRODUCT_MODULE_ID: 0,

  // My Address Module
  MY_ADDRESS: 'ine_my_address',
  MY_ADDRESS_MODULE_ID: 0,
  PINCODES: 'ine_state_district',

  // My Wishlist Module
  MY_WISHLIST: 'ine_wishlist',
  MY_WISHLIST_MODULE_ID: 0,

  // My Referral Module
  MY_REFERRAL: 'ine_my_referral',

  // My Giftcard Module
  MY_GIFTCARD: 'ine_my_giftcard',
  GIFTCARD_GENERATE: 'ine_giftcard_generate',
  MY_GIFTCARD_MODULE_ID: 0,

  // My Wallet Module
  My_WALLET: 'ine_my_wallet',

  // Cart Module
  CART: 'ine_cart',

  // Designer Module
  DESIGNER: 'ine_designer',
  DESIGNER_MODULE_ID: 15,

  // Category Module
  CATEGORY: 'ine_category',
  CATEGORY_MODULE_ID: 3,

  // ResinType Module
  RESINTYPE: 'ine_resin',
  RESINTYPE_MODULE_ID: 4,

  // Shape Module
  SHAPE: 'ine_shape',
  SHAPE_MODULE_ID: 5,

  // Size for Shape Module
  SIZEFORSHAPE: 'ine_size_for_shape',
  SIZEFORSHAPE_MODULE_ID: 6,

  // Bezel Material Module
  BEZELMATERIAL: 'ine_bezel_material',
  BEZELMATERIAL_MODULE_ID: 7,

  // Bezel Color Module
  BEZELCOLOR: 'ine_bezel_color',
  BEZELCOLOR_MODULE_ID: 8,

  // Inner Material
  INNERMATERIAL: 'ine_inner_material',
  INNERMATERIAL_MODULE_ID: 9,

  // Flower Module
  FLOWER: 'ine_flower',
  FLOWER_MODULE_ID: 10,

  // Color Shade Module
  COLORSHADE: 'ine_color_shade',
  COLORSHADE_MODULE_ID: 11,

  // Contact Us Module
  CONTACT_US: 'ine_contact_us',
  CONTACT_US_MODULE_ID: 0,
  CONTACT_INQUIRY: 'ine_contact_inquiry',
  CONTACT_INQUIRY_MODULE_ID: 0,

  // Notification Module
  ECOMMMETA: 'ine_ecomm_meta',

  // Pages Data Module
  PAGESDATA: 'ine_pages',
  PAGESDATA_MODULE_ID: 0,

  // Save Card Module
  SAVECARD: 'ine_save_cards',
  SAVECARD_MODULE_ID: 0,

  // Other Module
  ACTIVITYLOG: 'ine_other_activity',
  COUNTRIES: 'ine_countries',
  SETTINGS: 'ine_settings',
  SETTINGS_MODULE_ID: 0,
  STATE_DISTRICT: 'ine_state_district',


  STATE_TABLE: 'ine_states',
  PINCODE_TABLE:'ine_pincodes',
  POSTOFFICE_TABLE:'ine_post_offices',
  DISTRICT_TABLE: 'ine_districts',
  
  OTHER_ACTIVITY: 'ine_other_activity',
  ABOUT_US: 'ine_about_us',
  // MODULES 

  MODULES_TABLE: "ine_modules",
  PERMISSIONS_TABLE: "ine_permissions",

  // USERS 
  USERS: 'ine_users',
  USER_DETAILS: 'ine_users_details',
  USER_ADDRESSES: 'ine_users_addresses',
  MY_ADDRESSES: 'ine_my_address',

  TICKET_SUBJECT: 'ine_ticket_subject',

  // ACTIVITIES 
  OTHER_ACTIVITY: 'ine_other_activity',


  // ABOUT
  ABOUT_US: 'ine_about_us',

  //  SERIAL NUMBER 
  SERIAL_NUMBER: 'ine_serial_number_old',


  // REPLICATOR MODULE 
  REPLICATOR_MODULE: 18,
  REPLICATOR: 'ine_replicator',

  // WAREHOUSE 

  WAREHOUSE_RACKS_OLD: 'ine_warehouse_racks',
  WAREHOUSE: 'ine_warehouse',

  // OFFLINE SALES
  OFFLINE_SALES_MODULE_ID: 110,
  OFFLINE_SALES: 'ine_warehouse',

  // ONLINE SALES 
  ONLINE_SALES: 'ine_online_sales',

  // PACKERS MODULE 
  PACKERS: 'ine_packers',
  PACKER_MODULE_ID: 99,
  PACKERS_BOXES: 'ine_packers_boxes',
  PACKER_CARTONS: 'ine_packers_cartons',

  // CARTON TABLE 
  CARTON_ELEMENTS: 'ine_carton_elements',

  // FRONTEND PRODUCTS 
  PRODUCTS: 'ine_products',

  // DESIGNER MODULE 
  DESIGNER_MODULE_ID: 15,
  DESIGNER: 'ine_designer',

  // ROLES MODULE 
  ROLE_MODULE: 12,
  ROLES: 'ine_roles',

  // CAMPAIGN MODULE 
  CAMPAIGN_MODULE_ID: 98,
  CAMPAIGN: 'ine_campaign',

  // MARKETING MODULE 
  MARKETING_MODULE_ID: 94,
  MARKETING: 'ine_marketing',
  MARKETING_MEDIA_TABLE: 'ine_marketing_media',
  

  // Marketing Pending
  MARKETING_PENDING: 'ine_marketing_pending',
  MARKETING_PENDING_META_TABLE: 'ine_marketing_pending_media',

  // REQUEST MODULE 
  MANAGE_REQUEST_ID: 72,
  MANAGE_REQUEST: 'ine_manage_request',

  // RESIN MODULE
  CATEGORY_TABLE: "ine_category",
  CATEGORY_MODULE_ID: 3,

  // RESIN MODULE
  RESIN_TABLE: 'ine_resin',
  RESIN_MODULE_ID: 4,

  // SIZE FOR SHAPE MODULE
  SIZE_FOR_SHAPE_TABLE: 'ine_size_for_shape', // Table Name
  SIZE_FOR_SHAPE_MODULE_ID: 6, // Module ID

  // SHAPE MODULE
  SHAPE_TABLE: 'ine_shape', // Table Name
  SHAPE_MODULE_ID: 5, // Module ID


  // BEZEL MATERIAL MODULE
  BEZEL_MATERIAL: 'ine_bezel_material', // Table Name
  BEZEL_MATERIAL_MODULE_ID: 7, // Module ID

  BEZEL_COLOUR_TABLE: 'ine_bezel_color', // Table Name
  ine_bezel_color_ModuleID: 8, // Module ID

  // INNER MATERIAL MODULE
  INNER_MATERIAL_TABLE: 'ine_inner_material',// Table Name
  ine_inner_material_ModuleID: 9, // Module ID

  // INNER FLOWER MODULE
  FLOWER_TABLE: 'ine_flower', // Table Name
  FLOWER_MODULE_ID: 10, // Module ID

  // INNER COLOR SHADE MODULE
  COLOUR_SHADE: 'ine_color_shade', // Table Name
  ine_color_shade_ModuleID: 11, // Module ID


  INE_STATUS_TABLENAME: "ine_status",

  INE_MODULES_TABLE: 'ine_modules', // Table Name

  STATE_DISTRICT_TABLE: 'ine_state_district', // Table Name


  GIFTCARD_MODULE_ID: 17, // Module ID
  GIFTCARD_TABLE: "ine_giftcard", // Table Name
  GIFTCARD_GENERATE_TABLE: "ine_giftcard_generate",
  GIFTCARD_CALCULATE_TABLE: "ine_giftcard_calc",

  SUPPORT_CHANNEL_MODULE_ID: 114,


  ORDERS: 'ine_orders',
  ORDER_RETURN: 'ine_order_return',
  SERIAL_VERIFICATION: 'ine_serial_verification',
  ORDER_PRODUCTS: "ine_order_products",

  INE_ASSETS: "ine_assets",


  USER_CHECKOUT: "ine_users_checkout",
  USER_CART: "ine_cart",


  // AFFILIATE PAGE
  AFFILIATE_MODULE_ID: 153,
  AFFILIATE_TABLE: "ine_affiliate_program",

  // INVENTORY TABLE 
  INVENTORY: "ine_inventory",

  COLLECTIONS: 'ine_collections',



};

module.exports = TABLES;