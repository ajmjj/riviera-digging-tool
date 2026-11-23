export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** Represents a date and time value, serialized as a timestamp in milliseconds. */
  Date: { input: string; output: string; }
  /** Represents arbitrary JSON data as a scalar value. */
  JSON: { input: unknown; output: unknown; }
};

/** Represents a physical address. */
export type Address = {
  __typename?: 'Address';
  /** Internal database identifier. */
  _id: Maybe<Scalars['ID']['output']>;
  /** Primary street address line. */
  addressLine1: Maybe<Scalars['String']['output']>;
  /** Secondary street address line. */
  addressLine2: Maybe<Scalars['String']['output']>;
  /** Two-letter ISO 3166-1 alpha-2 country code. */
  alpha2: Maybe<Scalars['String']['output']>;
  /** City or locality name. */
  city: Maybe<Scalars['String']['output']>;
  /** Full country name. */
  country: Maybe<Scalars['String']['output']>;
  /** Optional description or label for the address. */
  description: Maybe<Scalars['String']['output']>;
  /** First name of the address recipient. */
  firstName: Maybe<Scalars['String']['output']>;
  /** Last name of the address recipient. */
  lastName: Maybe<Scalars['String']['output']>;
  /** Postal or ZIP code. */
  postCode: Maybe<Scalars['String']['output']>;
  /** State or province name. */
  state: Maybe<Scalars['String']['output']>;
  /** State or province code abbreviation. */
  stateCode: Maybe<Scalars['String']['output']>;
  /** Street number component. */
  streetNumber: Maybe<Scalars['String']['output']>;
  /** Type of address (e.g., "billing", "shipping"). */
  type: Maybe<Scalars['String']['output']>;
};

/** Input fields for specifying a physical address. */
export type AddressInput = {
  /** Internal database identifier for an existing address. */
  _id?: InputMaybe<Scalars['ID']['input']>;
  /** Primary street address line. */
  addressLine1?: InputMaybe<Scalars['String']['input']>;
  /** Secondary street address line. */
  addressLine2?: InputMaybe<Scalars['String']['input']>;
  /** Two-letter ISO 3166-1 alpha-2 country code. */
  alpha2?: InputMaybe<Scalars['String']['input']>;
  /** City or locality name. */
  city?: InputMaybe<Scalars['String']['input']>;
  /** Full country name. */
  country?: InputMaybe<Scalars['String']['input']>;
  /** Optional description or label for the address. */
  description?: InputMaybe<Scalars['String']['input']>;
  /** First name of the address recipient. */
  firstName?: InputMaybe<Scalars['String']['input']>;
  /** Last name of the address recipient. */
  lastName?: InputMaybe<Scalars['String']['input']>;
  /** Postal or ZIP code. */
  postCode?: InputMaybe<Scalars['String']['input']>;
  /** State or province name. */
  state?: InputMaybe<Scalars['String']['input']>;
  /** State or province code abbreviation. */
  stateCode?: InputMaybe<Scalars['String']['input']>;
  /** Street number component. */
  streetNumber?: InputMaybe<Scalars['String']['input']>;
  /** Type of address (e.g., "billing", "shipping"). */
  type?: InputMaybe<Scalars['String']['input']>;
};

/** Represents a blog post, page, or article with content and metadata. */
export type Article = {
  __typename?: 'Article';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Article content in various formats. */
  content: ArticleContent;
  /**
   * Creation date of the article.
   * @deprecated Field no longer supported
   */
  created: Maybe<Scalars['Date']['output']>;
  /** URL-friendly handle for the article. */
  handle: Scalars['String']['output'];
  /** Whether this article is set as the homepage. */
  homepage: Maybe<Scalars['Boolean']['output']>;
  /** Numeric identifier for the article. */
  id: Scalars['Int']['output'];
  /**
   * Last modification date of the article.
   * @deprecated Field no longer supported
   */
  modified: Maybe<Scalars['Date']['output']>;
  /** Whether the article is private and requires authentication. */
  private: Maybe<Scalars['Boolean']['output']>;
  /** Publication status and date. */
  published: Maybe<ArticlePublished>;
  /** SEO metadata for the article. */
  seo: Maybe<SeoEntry>;
  /** Tags associated with the article. */
  tags: Array<Scalars['String']['output']>;
  /** Thumbnail image for the article. */
  thumbnail: Maybe<Media>;
  /** Title of the article. */
  title: Scalars['String']['output'];
  /** Type of article content format. */
  type: Maybe<ArticleType>;
  /** URL path to the article. */
  url: Maybe<Scalars['String']['output']>;
};

/** Article content in multiple formats: plain text, HTML, structured editor, or rows. */
export type ArticleContent = {
  __typename?: 'ArticleContent';
  /** Structured editor content in JSON format. */
  editor: Maybe<Scalars['JSON']['output']>;
  /** HTML-formatted content. */
  html: Maybe<Scalars['String']['output']>;
  /** Structured content organized in rows and columns. */
  rows: Array<ArticleContentRow>;
  /** Plain text content. */
  text: Maybe<Scalars['String']['output']>;
};

/** A single content block within an article's structured content. */
export type ArticleContentBlock = {
  __typename?: 'ArticleContentBlock';
  /** Block-specific data in JSON format. */
  data: Maybe<Scalars['JSON']['output']>;
  /** Unique identifier for the block. */
  id: Maybe<Scalars['ID']['output']>;
  /** Type of content block. */
  type: Maybe<Scalars['String']['output']>;
};

/** A column containing multiple content blocks. */
export type ArticleContentColumn = {
  __typename?: 'ArticleContentColumn';
  /** Content blocks within this column. */
  blocks: Array<ArticleContentBlock>;
  /** Unique identifier for the column. */
  id: Maybe<Scalars['ID']['output']>;
};

/** A row containing multiple columns of content blocks. */
export type ArticleContentRow = {
  __typename?: 'ArticleContentRow';
  /** Columns within this row. */
  columns: Array<ArticleContentColumn>;
  /** Unique identifier for the row. */
  id: Maybe<Scalars['ID']['output']>;
  /** Layout identifier for the row. */
  layout: Maybe<Scalars['String']['output']>;
  /** Display options for this row. */
  options: Maybe<ArticleContentRowOptions>;
};

/** Display options for an article content row. */
export type ArticleContentRowOptions = {
  __typename?: 'ArticleContentRowOptions';
  /** Background color for the row. */
  backgroundColor: Maybe<Scalars['String']['output']>;
  /** Whether to display content as a carousel. */
  carousel: Maybe<Scalars['Boolean']['output']>;
  /** Whether the row spans the full width. */
  fullWidth: Maybe<Scalars['Boolean']['output']>;
  /** Whether to remove padding from the row. */
  noPadding: Maybe<Scalars['Boolean']['output']>;
};

/** Link to an article for navigation or display. */
export type ArticleLink = {
  __typename?: 'ArticleLink';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** URL-friendly handle for the article. */
  handle: Scalars['String']['output'];
  /** Numeric identifier for the article. */
  id: Scalars['Int']['output'];
  /**
   * Article title (deprecated).
   * @deprecated Field no longer supported
   */
  title: Maybe<Scalars['String']['output']>;
  /**
   * Article type (deprecated).
   * @deprecated Field no longer supported
   */
  type: Maybe<Scalars['String']['output']>;
};

/** Publication status and date for an article. */
export type ArticlePublished = {
  __typename?: 'ArticlePublished';
  /** Publication date. */
  date: Maybe<Scalars['Date']['output']>;
  /** Whether the article is published. */
  status: Maybe<Scalars['Boolean']['output']>;
};

/** Type of article content format. */
export type ArticleType =
  /** Editor-structured article. */
  | 'editor'
  /** HTML-formatted article. */
  | 'html'
  /** Static page article. */
  | 'page'
  /** Blog post article. */
  | 'post'
  /** Plain text article. */
  | 'text';

/** Represents an artist with profile information, images, and metadata. */
export type Artist = {
  __typename?: 'Artist';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Artist name variations (ANVs). */
  anvs: Maybe<Array<Scalars['String']['output']>>;
  /** Country of origin for the artist. */
  country: Maybe<ArtistCountry>;
  /** Date when the artist record was created. */
  createdAt: Maybe<Scalars['Date']['output']>;
  /** External identifier from the marketplace system. */
  discogsId: Maybe<Scalars['Int']['output']>;
  /** Numeric identifier for the artist. */
  id: Maybe<Scalars['Float']['output']>;
  /** Images associated with the artist. */
  images: Maybe<Array<ArtistImage>>;
  /** Members of the artist group or band. */
  members: Maybe<Array<ArtistMember>>;
  /** Date when the artist record was last modified. */
  modifiedAt: Maybe<Scalars['Date']['output']>;
  /** Artist name. */
  name: Scalars['String']['output'];
  /** Biography or profile text for the artist. */
  profile: Maybe<Scalars['String']['output']>;
  /** Tags associated with the artist. */
  tags: Maybe<Array<Scalars['String']['output']>>;
  /** Official websites for the artist. */
  websites: Maybe<Array<Scalars['String']['output']>>;
};

/** Country information for an artist. */
export type ArtistCountry = {
  __typename?: 'ArtistCountry';
  /** Two-letter ISO country code. */
  alpha2: Maybe<Scalars['String']['output']>;
  /** Country name. */
  name: Maybe<Scalars['String']['output']>;
};

/** Image associated with an artist. */
export type ArtistImage = {
  __typename?: 'ArtistImage';
  /** URI to the thumbnail image. */
  thumbnail: Maybe<Scalars['String']['output']>;
  /** URI to the full-size image. */
  uri: Maybe<Scalars['String']['output']>;
};

/** Member of an artist group or band. */
export type ArtistMember = {
  __typename?: 'ArtistMember';
  /** External identifier for the member. */
  id: Maybe<Scalars['Float']['output']>;
  /** Name of the member. */
  name: Maybe<Scalars['String']['output']>;
};

/** Industry identifier for a book item (e.g., ISBN, ASIN). */
export type BookIndustryIdentifier = {
  __typename?: 'BookIndustryIdentifier';
  /** The identifier value. */
  identifier: Maybe<Scalars['String']['output']>;
  /** Type of identifier (e.g., "ISBN_13", "ASIN"). */
  type: Maybe<Scalars['String']['output']>;
};

export type CacheControlScope =
  | 'PRIVATE'
  | 'PUBLIC';

/** Represents a shopping cart checkout session with items, pricing, and buyer information. */
export type Checkout = {
  __typename?: 'Checkout';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Billing and payment information. */
  billing: CheckoutBilling;
  /** Buyer information. */
  buyer: Maybe<CheckoutBuyer>;
  /** Configuration reference for the shop. */
  configRef: Maybe<Scalars['ID']['output']>;
  /** Date when the checkout was created. */
  created: Scalars['Date']['output'];
  /** Date when the checkout expires. */
  expires: Maybe<Scalars['Date']['output']>;
  /** Checkout identifier string. */
  id: Scalars['String']['output'];
  /** Items in the checkout. */
  items: Array<CheckoutLineItem>;
  /** Optional message about the checkout status. */
  message: Maybe<Scalars['String']['output']>;
  /** Note or comment associated with the checkout. */
  note: Maybe<CheckoutNote>;
  /**
   * Order identifier if the checkout has been converted to an order.
   * @deprecated Field no longer supported
   */
  orderId: Maybe<Scalars['String']['output']>;
  /** Origin of the checkout (e.g., "Online"). */
  origin: Scalars['String']['output'];
  /** Seller or shop user information. */
  seller: Maybe<CheckoutUser>;
  /** Shipping information. */
  shipping: CheckoutShipping;
  /** Current status of the checkout (e.g., "open", "complete"). */
  status: Scalars['String']['output'];
  /** Total amounts for the checkout. */
  totals: CheckoutTotals;
  /** Date when the checkout was last updated. */
  updated: Maybe<Scalars['Date']['output']>;
  /** URLs associated with the checkout. */
  urls: CheckoutUrls;
  /** Whether to use the same address for billing and shipping. */
  useSingleAddress: Maybe<Scalars['Boolean']['output']>;
};

/** Billing and payment information for a checkout. */
export type CheckoutBilling = {
  __typename?: 'CheckoutBilling';
  /** Billing address. */
  address: Maybe<Address>;
  /** Invoice information for this checkout. */
  invoice: Maybe<CheckoutInvoice>;
  /** Date when payment was received. */
  paymentDate: Maybe<Scalars['Date']['output']>;
  /** Payment methods used for this checkout. */
  paymentMethods: Maybe<Array<CheckoutPaymentMethod>>;
  /** Date when refund was issued. */
  refundDate: Maybe<Scalars['Date']['output']>;
  /** Refunds issued for this checkout. */
  refunds: Maybe<Array<CheckoutPaymentMethod>>;
  /** Billing status (e.g., "pending", "paid", "refunded"). */
  status: Maybe<Scalars['String']['output']>;
  /** Voucher applied to this checkout. */
  voucher: Maybe<CheckoutVoucher>;
};

/** Input fields for billing information. */
export type CheckoutBillingInput = {
  /** Billing address. */
  address?: InputMaybe<AddressInput>;
  /** Voucher to apply. */
  voucher?: InputMaybe<CheckoutVoucherInput>;
};

/** Buyer information for a checkout. */
export type CheckoutBuyer = {
  __typename?: 'CheckoutBuyer';
  /** Internal database identifier. */
  _id: Maybe<Scalars['String']['output']>;
  /** Email address of the buyer. */
  email: Maybe<Scalars['String']['output']>;
  /** Buyer's first name. */
  firstName: Maybe<Scalars['String']['output']>;
  /** Numeric identifier for the buyer. */
  id: Maybe<Scalars['Float']['output']>;
  /** Whether the buyer is a guest (not registered). */
  isGuest: Maybe<Scalars['Boolean']['output']>;
  /** Buyer's last name. */
  lastName: Maybe<Scalars['String']['output']>;
  /** Full name of the buyer. */
  name: Maybe<Scalars['String']['output']>;
  /** Organization or company name. */
  organisation: Maybe<Scalars['String']['output']>;
  /** Tax identification number. */
  taxNumber: Maybe<Scalars['String']['output']>;
  /** Telephone number. */
  telephone: Maybe<Scalars['String']['output']>;
};

/** Input fields for buyer information in a checkout. */
export type CheckoutBuyerInput = {
  /** Internal database identifier for an existing buyer. */
  _id?: InputMaybe<Scalars['String']['input']>;
  /** Email address of the buyer. */
  email: Scalars['String']['input'];
  /** Buyer's first name. */
  firstName: Scalars['String']['input'];
  /** Numeric identifier for the buyer. */
  id?: InputMaybe<Scalars['Float']['input']>;
  /** Whether the buyer is a guest (not registered). */
  isGuest?: InputMaybe<Scalars['Boolean']['input']>;
  /** Buyer's last name. */
  lastName: Scalars['String']['input'];
  /** Full name of the buyer. */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Organization or company name. */
  organisation?: InputMaybe<Scalars['String']['input']>;
  /** Tax identification number. */
  taxNumber?: InputMaybe<Scalars['String']['input']>;
  /** Telephone number. */
  telephone?: InputMaybe<Scalars['String']['input']>;
};

/** Email notification information. */
export type CheckoutEmail = {
  __typename?: 'CheckoutEmail';
  /** Date when the email was sent. */
  date: Maybe<Scalars['Date']['output']>;
  /** Email recipient address. */
  recipient: Maybe<Scalars['String']['output']>;
};

/** Input fields for email notification. */
export type CheckoutEmailInput = {
  /** Email recipient address. */
  recipient?: InputMaybe<Scalars['String']['input']>;
};

/** Invoice information for a checkout. */
export type CheckoutInvoice = {
  __typename?: 'CheckoutInvoice';
  /** Invoice date. */
  date: Maybe<Scalars['Date']['output']>;
  /** Email notifications sent for this invoice. */
  emails: Maybe<Array<CheckoutEmail>>;
  /** Invoice identifier string. */
  id: Maybe<Scalars['String']['output']>;
  /** URL to the invoice PDF file. */
  pdf: Maybe<Scalars['String']['output']>;
};

/** Item information for a checkout line item. */
export type CheckoutItem = {
  __typename?: 'CheckoutItem';
  /** Description of the item. */
  description: Scalars['String']['output'];
  /** Numeric identifier for the item. */
  id: Maybe<Scalars['Float']['output']>;
  /** URL path to the item page. */
  path: Maybe<Scalars['String']['output']>;
  /** URL to the item thumbnail image. */
  thumbnail: Maybe<Scalars['String']['output']>;
  /** Weight of the item. */
  weight: Maybe<Scalars['String']['output']>;
};

/** Input fields for adding an item to a checkout. */
export type CheckoutItemInput = {
  /** Numeric identifier for the listing. */
  listingId: Scalars['Float']['input'];
  /** Quantity of items to add. */
  quantity: Scalars['Float']['input'];
};

/** A single line item in a checkout with quantity and pricing. */
export type CheckoutLineItem = {
  __typename?: 'CheckoutLineItem';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Date when this item was added to the checkout. */
  added: Maybe<Scalars['Date']['output']>;
  /**
   * Line item identifier.
   * @deprecated Field no longer supported
   */
  id: Maybe<Scalars['ID']['output']>;
  /** Item information for this line item. */
  item: CheckoutItem;
  /** Listing information for this line item. */
  listing: CheckoutListing;
  /** Pricing information for this line item. */
  price: CheckoutLinePrice;
  /** Quantity of items in this line. */
  quantity: Scalars['Float']['output'];
  /** Total price for this line item. */
  total: Maybe<Scalars['Float']['output']>;
  /** Whether this item is currently unavailable. */
  unavailable: Maybe<Scalars['Boolean']['output']>;
};

/** Pricing information for a checkout line item including taxes. */
export type CheckoutLinePrice = {
  __typename?: 'CheckoutLinePrice';
  /** Base price of the line item. */
  base: Scalars['Float']['output'];
  /** Price before taxes are applied. */
  beforeTaxes: Scalars['Float']['output'];
  /** Subtotal for this line item including taxes. */
  subtotal: Scalars['Float']['output'];
  /** Subtotal for this line item before taxes. */
  subtotalBeforeTaxes: Scalars['Float']['output'];
  /** Taxes applied to this line item. */
  taxes: Maybe<Array<CheckoutTax>>;
};

/** Listing information for an item in a checkout. */
export type CheckoutListing = {
  __typename?: 'CheckoutListing';
  /** Internal database identifier. */
  _id: Scalars['String']['output'];
  /** Date when the item becomes available for purchase. */
  available: Maybe<Scalars['Date']['output']>;
  /** Categories this listing belongs to. */
  categories: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  /** Public comments about the listing. */
  comments: Maybe<Scalars['String']['output']>;
  /** External identifier from the marketplace system. */
  discogsId: Maybe<Scalars['String']['output']>;
  /** Numeric identifier for the listing. */
  id: Scalars['Float']['output'];
  /** Physical location of the item. */
  location: Maybe<Scalars['String']['output']>;
  /** Whether only one item per customer is allowed. */
  onePerCustomer: Maybe<Scalars['Boolean']['output']>;
  /** Product option variants for this listing. */
  options: Array<CheckoutListingOption>;
  /** Date when the listing was posted. */
  posted: Maybe<Scalars['Date']['output']>;
  /** Whether this is a pre-order listing. */
  preOrder: Maybe<Scalars['Boolean']['output']>;
  /** Whether to prevent listing on the marketplace system. */
  preventDiscogsListing: Maybe<Scalars['Boolean']['output']>;
  /** Pricing information for this listing. */
  prices: CheckoutListingPrice;
  /** Private comments visible only to shop administrators. */
  privateComments: Maybe<Scalars['String']['output']>;
  /** Stock quantity information. */
  stock: CheckoutStock;
  /** Supplier code for this listing. */
  supplierCode: Maybe<Scalars['String']['output']>;
  /** Tax definition identifier for this listing. */
  taxDefinition: Maybe<Scalars['String']['output']>;
};

/** Product option for a checkout listing. */
export type CheckoutListingOption = {
  __typename?: 'CheckoutListingOption';
  /** Option identifier. */
  id: Maybe<Scalars['String']['output']>;
  /** Name of the option (e.g., "Size", "Color"). */
  name: Maybe<Scalars['String']['output']>;
  /** Value of the option (e.g., "Large", "Red"). */
  value: Maybe<Scalars['String']['output']>;
};

/** Pricing information for a listing in a checkout. */
export type CheckoutListingPrice = {
  __typename?: 'CheckoutListingPrice';
  /** Base price of the listing. */
  base: Maybe<Scalars['Float']['output']>;
  /** Price before taxes are applied. */
  beforeTaxes: Maybe<Scalars['Float']['output']>;
  /** Original compare price as a string. */
  compare: Maybe<Scalars['String']['output']>;
  /** Cost price as a string. */
  cost: Maybe<Scalars['String']['output']>;
  /** Current sale price as a string. */
  sale: Maybe<Scalars['String']['output']>;
};

/** Available shipping method with total cost. */
export type CheckoutMethod = {
  __typename?: 'CheckoutMethod';
  /** Name of the shipping method. */
  name: Scalars['String']['output'];
  /** Total cost for this shipping method. */
  total: Scalars['Float']['output'];
};

/** Note or comment associated with a checkout. */
export type CheckoutNote = {
  __typename?: 'CheckoutNote';
  /** Content of the note. */
  content: Maybe<Scalars['String']['output']>;
  /** Date when the note was created. */
  date: Maybe<Scalars['Date']['output']>;
  /** User who created the note. */
  user: Maybe<CheckoutUser>;
};

/** Payment method information for a checkout. */
export type CheckoutPaymentMethod = {
  __typename?: 'CheckoutPaymentMethod';
  /** Date when the payment method was added. */
  added: Maybe<Scalars['Date']['output']>;
  /** Amount paid or refunded via this payment method. */
  amount: Scalars['Float']['output'];
  /** Display label for the payment method. */
  label: Maybe<Scalars['String']['output']>;
  /** Origin of the payment (e.g., "stripe", "paypal"). */
  origin: Maybe<Scalars['String']['output']>;
};

/** Shipping information for a checkout. */
export type CheckoutShipping = {
  __typename?: 'CheckoutShipping';
  /** Shipping address. */
  address: Maybe<Address>;
  /** Shipping confirmation email information. */
  confirmationEmail: Maybe<CheckoutEmail>;
  /** Expected or actual shipping date. */
  date: Maybe<Scalars['Date']['output']>;
  /** Minimum order amount to qualify for free shipping. */
  freeShippingThreshold: Maybe<Scalars['Float']['output']>;
  /** Selected shipping method identifier. */
  method: Maybe<Scalars['String']['output']>;
  /** Available shipping methods with costs. */
  methods: Maybe<Array<CheckoutMethod>>;
  /** Shipping price information including taxes. */
  price: CheckoutShippingPrice;
  /** Whether this is a shop collection order (pickup in store). */
  shopCollection: Maybe<Scalars['Boolean']['output']>;
  /** Shipping status (e.g., "pending", "shipped"). */
  status: Maybe<Scalars['String']['output']>;
  /** Tracking number for shipped orders. */
  tracking: Maybe<Scalars['String']['output']>;
  /** Total weight of items for shipping calculation. */
  weight: Maybe<Scalars['String']['output']>;
};

/** Input fields for shipping information. */
export type CheckoutShippingInput = {
  /** Shipping address. */
  address?: InputMaybe<AddressInput>;
  /** Shipping confirmation email information. */
  confirmationEmail?: InputMaybe<CheckoutEmailInput>;
  /** Shipping method identifier. */
  method?: InputMaybe<Scalars['String']['input']>;
  /** Whether this is a shop collection order (pickup in store). */
  shopCollection?: InputMaybe<Scalars['Boolean']['input']>;
  /** Tracking number for shipped orders. */
  tracking?: InputMaybe<Scalars['String']['input']>;
};

/** Shipping price information including taxes. */
export type CheckoutShippingPrice = {
  __typename?: 'CheckoutShippingPrice';
  /** Base shipping price. */
  base: Scalars['Float']['output'];
  /** Shipping price before taxes are applied. */
  beforeTaxes: Scalars['Float']['output'];
  /** Shipping subtotal including taxes. */
  subtotal: Maybe<Scalars['Float']['output']>;
  /** Shipping subtotal before taxes. */
  subtotalBeforeTaxes: Maybe<Scalars['Float']['output']>;
  /** Taxes applied to shipping. */
  taxes: Maybe<Array<CheckoutTax>>;
};

/** Spending record for a voucher (tracks order usage). */
export type CheckoutSpending = {
  __typename?: 'CheckoutSpending';
  /** Amount spent using the voucher. */
  amount: Maybe<Scalars['String']['output']>;
  /** Order identifier where the voucher was used. */
  orderId: Maybe<Scalars['String']['output']>;
};

/** Stock quantity information for a checkout listing. */
export type CheckoutStock = {
  __typename?: 'CheckoutStock';
  /** Available quantity in stock. Null means stock is not tracked (always available). */
  quantity: Maybe<Scalars['Float']['output']>;
};

/** Tax information applied to a checkout item or shipping. */
export type CheckoutTax = {
  __typename?: 'CheckoutTax';
  /** Tax amount in the shop's currency. */
  amount: Maybe<Scalars['Float']['output']>;
  /** Name of the tax (e.g., "VAT", "Sales Tax"). */
  name: Maybe<Scalars['String']['output']>;
  /** Tax rate as a percentage. */
  rate: Maybe<Scalars['Float']['output']>;
};

/** Total amounts for a checkout including items, shipping, taxes, and discounts. */
export type CheckoutTotals = {
  __typename?: 'CheckoutTotals';
  /** Discount amount applied. */
  discount: Maybe<Scalars['Float']['output']>;
  /** Grand total amount to pay. */
  grand: Scalars['Float']['output'];
  /** Total quantity of items. */
  itemQuantity: Maybe<Scalars['Int']['output']>;
  /**
   * Total quantity of items (deprecated, use itemQuantity).
   * @deprecated Field no longer supported
   */
  itemsQuantity: Maybe<Scalars['Float']['output']>;
  /** Amount remaining to be paid. */
  leftToPay: Scalars['Float']['output'];
  /** Shipping cost. */
  shipping: Scalars['Float']['output'];
  /** Subtotal including taxes. */
  subtotal: Scalars['Float']['output'];
  /** Subtotal before taxes are applied. */
  subtotalBeforeTaxes: Scalars['Float']['output'];
  /** Total tax amount. */
  tax: Maybe<Scalars['Float']['output']>;
  /** List of taxes applied. */
  taxes: Array<CheckoutTotalsTax>;
};

/** Tax information in checkout totals. */
export type CheckoutTotalsTax = {
  __typename?: 'CheckoutTotalsTax';
  /** Tax amount. */
  amount: Maybe<Scalars['Float']['output']>;
  /** Name of the tax. */
  name: Maybe<Scalars['String']['output']>;
  /** Tax rate as a percentage. */
  rate: Maybe<Scalars['Float']['output']>;
};

/** URLs associated with a checkout. */
export type CheckoutUrls = {
  __typename?: 'CheckoutUrls';
  /** URL to the checkout page. */
  checkout: Scalars['String']['output'];
  /** URL to the storefront homepage. */
  storefront: Scalars['String']['output'];
};

/** User information associated with a checkout. */
export type CheckoutUser = {
  __typename?: 'CheckoutUser';
  /** Internal database identifier. */
  _id: Maybe<Scalars['String']['output']>;
  /** Email address. */
  email: Maybe<Scalars['String']['output']>;
  /** User's first name. */
  firstName: Maybe<Scalars['String']['output']>;
  /** User identifier string. */
  id: Maybe<Scalars['String']['output']>;
  /** User's last name. */
  lastName: Maybe<Scalars['String']['output']>;
  /** Full name of the user. */
  name: Maybe<Scalars['String']['output']>;
  /** Tax identification number. */
  taxNumber: Maybe<Scalars['String']['output']>;
  /** Telephone number. */
  telephone: Maybe<Scalars['String']['output']>;
};

/** Response from verifying and updating a checkout. */
export type CheckoutVerifyAndUpdateResponse = {
  __typename?: 'CheckoutVerifyAndUpdateResponse';
  /** Updated checkout information. */
  checkout: Maybe<Checkout>;
  /** Optional message about the verification or update. */
  message: Maybe<Scalars['String']['output']>;
};

/** Voucher information applied to a checkout. */
export type CheckoutVoucher = {
  __typename?: 'CheckoutVoucher';
  /** Date when the voucher was created. */
  created: Maybe<Scalars['Date']['output']>;
  /** Expiration date of the voucher. */
  expires: Maybe<Scalars['Date']['output']>;
  /** Voucher identifier string. */
  id: Maybe<Scalars['String']['output']>;
  /** Note associated with the voucher. */
  note: Maybe<CheckoutNote>;
  /** Original value of the voucher before redemption. */
  originalValue: Maybe<Scalars['String']['output']>;
  /** Type of voucher redemption (e.g., "percentage", "fixed"). */
  redeemType: Maybe<Scalars['String']['output']>;
  /** Whether the voucher has been redeemed. */
  redeemed: Maybe<Scalars['Boolean']['output']>;
  /** Whether the voucher has unlimited uses. */
  unlimited: Maybe<Scalars['Boolean']['output']>;
  /** User who owns or used the voucher. */
  user: Maybe<CheckoutUser>;
  /** Current value of the voucher after redemption. */
  value: Maybe<Scalars['String']['output']>;
};

/** Input fields for voucher information. */
export type CheckoutVoucherInput = {
  /** Voucher identifier string. */
  id?: InputMaybe<Scalars['String']['input']>;
  /** Type of voucher redemption. */
  redeemType?: InputMaybe<Scalars['String']['input']>;
  /** Voucher code or value. */
  value?: InputMaybe<Scalars['String']['input']>;
};

/** Represents a curated collection of items with filtering and display settings. */
export type Collection = {
  __typename?: 'Collection';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Banner image for the collection. */
  banner: Maybe<CollectionBanner>;
  /** Description of the collection. */
  description: Maybe<CollectionDescription>;
  /** URL-friendly handle for the collection. */
  handle: Scalars['String']['output'];
  /** Numeric identifier for the collection. */
  id: Scalars['Int']['output'];
  /** URL path to the collection page. */
  path: Maybe<Scalars['String']['output']>;
  /** SEO metadata for the collection. */
  seo: Maybe<SeoEntry>;
  /** Default sort configuration for the collection. */
  sort: Maybe<CollectionSort>;
  /** Title of the collection. */
  title: Scalars['String']['output'];
  /** View type for displaying the collection. */
  viewType: Maybe<Scalars['String']['output']>;
};

/** Banner image for a collection. */
export type CollectionBanner = {
  __typename?: 'CollectionBanner';
  /** Format identifier for the banner. */
  format: Maybe<Scalars['String']['output']>;
  /** Media file for the banner. */
  media: Maybe<Media>;
};

/** Description content for a collection. */
export type CollectionDescription = {
  __typename?: 'CollectionDescription';
  /** Description text content. */
  content: Maybe<Scalars['String']['output']>;
};

/** A collection with paginated items. */
export type CollectionItems = {
  __typename?: 'CollectionItems';
  /** The collection information. */
  collection: Collection;
  /** Items in the current page. */
  items: Array<Item>;
  /** Pagination metadata for the results. */
  pagination: Pagination;
};

/** A paginated page of items from a collection. */
export type CollectionPage = {
  __typename?: 'CollectionPage';
  /** Items in the current page. */
  items: Array<Item>;
  /** Pagination metadata for the results. */
  pagination: Pagination;
};

/** Sort configuration for a collection. */
export type CollectionSort = {
  __typename?: 'CollectionSort';
  /** Field name to sort by. */
  key: Maybe<Scalars['String']['output']>;
  /** Sort order (1 for ascending, -1 for descending). */
  order: Maybe<Scalars['Int']['output']>;
};

/** A collection with its first page of items. */
export type CollectionWithData = {
  __typename?: 'CollectionWithData';
  /** The collection information. */
  collection: Collection;
  /** First page of items in the collection. */
  page: CollectionPage;
};

/** Represents the complete shop configuration including e-shop settings, payment methods, and integrations. */
export type Config = {
  __typename?: 'Config';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /**
   * API key configuration (deprecated).
   * @deprecated Field no longer supported
   */
  apiKey: Maybe<ConfigApiKey>;
  /** Available articles for navigation or display. */
  articles: Array<ArticleLink>;
  /**
   * Product categories (deprecated).
   * @deprecated Field no longer supported
   */
  categories: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  /**
   * Product categories (deprecated).
   * @deprecated Field no longer supported
   */
  categoriesProduct: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  /** Currency code (e.g., "EUR", "USD"). */
  currency: Scalars['String']['output'];
  /** Currency symbol (e.g., "€", "$"). */
  currencySymbol: Maybe<Scalars['String']['output']>;
  /** Position of the currency symbol relative to the amount (e.g., "before", "after"). */
  currencySymbolPosition: Maybe<Scalars['String']['output']>;
  /** Primary domain name for the shop. */
  domain: Maybe<Scalars['String']['output']>;
  /** E-shop configuration including theme, checkout, and preferences. */
  eshop: Eshop;
  /** Google integration configuration. */
  google: Maybe<Google>;
  /** Numeric identifier for the configuration. */
  id: Scalars['Int']['output'];
  /** Meta (Facebook) integration configuration. */
  meta: Maybe<Meta>;
  /** Configuration modules with custom data. */
  modules: Array<ConfigModule>;
  /**
   * Product types (deprecated).
   * @deprecated Field no longer supported
   */
  productTypes: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  /** Name of the shop. */
  shopName: Scalars['String']['output'];
  /** Configured sites for multi-site setups. */
  sites: Array<ConfigSite>;
  /** Social media links. */
  socials: Maybe<Array<ConfigSocial>>;
  /** Tax configuration. */
  taxes: ConfigTaxes;
  /** Base URI for the shop. */
  uri: Maybe<Scalars['String']['output']>;
};

/** API key configuration for external integrations. */
export type ConfigApiKey = {
  __typename?: 'ConfigApiKey';
  /** Description of the API key's purpose. */
  description: Maybe<Scalars['String']['output']>;
  /** Whether the API key is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
  /** Name of the API key. */
  name: Maybe<Scalars['String']['output']>;
  /** API key value. */
  value: Maybe<Scalars['String']['output']>;
};

/** Head section configuration for HTML output. */
export type ConfigEshopHead = {
  __typename?: 'ConfigEshopHead';
  /** Additional HTML tags to include in the head section. */
  tags: Maybe<Array<Maybe<Scalars['String']['output']>>>;
};

/** E-shop preferences and feature settings. */
export type ConfigEshopPreferences = {
  __typename?: 'ConfigEshopPreferences';
  /** Access control preferences. */
  access: ConfigEshopPreferencesAccess;
  /** Homepage configuration. */
  homepage: Maybe<ConfigEshopPreferencesHomepage>;
  /** Language preferences. */
  languages: Maybe<ConfigEshopPreferencesLanguages>;
  /** Audio player preferences. */
  player: Maybe<ConfigEshopPreferencesPlayer>;
  /** Item suggestions preferences. */
  suggestions: Maybe<ConfigEshopPreferencesSuggestions>;
  /** Wantlist feature preferences. */
  wantlist: Maybe<ConfigEshopPreferencesWantlist>;
};

/** Access control preferences. */
export type ConfigEshopPreferencesAccess = {
  __typename?: 'ConfigEshopPreferencesAccess';
  /** Maintenance mode configuration. */
  maintenance: ConfigEshopPreferencesAccessMaintenance;
  /** Private access configuration. */
  private: ConfigEshopPreferencesAccessPrivate;
};

/** Maintenance mode configuration. */
export type ConfigEshopPreferencesAccessMaintenance = {
  __typename?: 'ConfigEshopPreferencesAccessMaintenance';
  /** Whether maintenance mode is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
  /** Message to display during maintenance. */
  message: Maybe<Scalars['String']['output']>;
};

/** Private access configuration. */
export type ConfigEshopPreferencesAccessPrivate = {
  __typename?: 'ConfigEshopPreferencesAccessPrivate';
  /** Whether private access is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
  /** Message to display when access is restricted. */
  message: Maybe<Scalars['String']['output']>;
};

/** Homepage configuration. */
export type ConfigEshopPreferencesHomepage = {
  __typename?: 'ConfigEshopPreferencesHomepage';
  /** Handle or identifier for the homepage content. */
  handle: Scalars['String']['output'];
  /** Reference identifier for the homepage content. */
  ref: Maybe<Scalars['ID']['output']>;
  /** Type of homepage (e.g., "article", "collection"). */
  type: Scalars['String']['output'];
};

/** Language preferences configuration. */
export type ConfigEshopPreferencesLanguages = {
  __typename?: 'ConfigEshopPreferencesLanguages';
  /** Whitelist of allowed language codes. */
  whitelist: Maybe<Array<Scalars['String']['output']>>;
};

/** Audio player preferences. */
export type ConfigEshopPreferencesPlayer = {
  __typename?: 'ConfigEshopPreferencesPlayer';
  /** Whether the audio player is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
};

/** Item suggestions preferences. */
export type ConfigEshopPreferencesSuggestions = {
  __typename?: 'ConfigEshopPreferencesSuggestions';
  /** Whether item suggestions are enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
};

/** Wantlist feature preferences. */
export type ConfigEshopPreferencesWantlist = {
  __typename?: 'ConfigEshopPreferencesWantlist';
  /** Whether the wantlist feature is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
};

/** SEO configuration for the e-shop. */
export type ConfigEshopSeo = {
  __typename?: 'ConfigEshopSeo';
  /** Meta description for search engines. */
  description: Maybe<Scalars['String']['output']>;
  /** URL to the favicon image. */
  favicon: Maybe<Scalars['String']['output']>;
  /** URL to the default social sharing image. */
  image: Maybe<Scalars['String']['output']>;
  /** Whether search engines should index the shop. */
  index: Maybe<Scalars['Boolean']['output']>;
  /** Whether search engines should index the catalog. */
  indexCatalogue: Maybe<Scalars['Boolean']['output']>;
  /** Robots meta tag content. */
  robots: Maybe<Scalars['String']['output']>;
  /** SEO title for the shop. */
  title: Maybe<Scalars['String']['output']>;
};

/** Configuration module with custom data. */
export type ConfigModule = {
  __typename?: 'ConfigModule';
  /** Module-specific configuration data in JSON format. */
  data: Maybe<Scalars['JSON']['output']>;
  /** Module identifier. */
  id: Maybe<Scalars['String']['output']>;
};

/** Site configuration for a multi-site setup. */
export type ConfigSite = {
  __typename?: 'ConfigSite';
  /** Domain name for this site. */
  domain: Maybe<Scalars['String']['output']>;
  /** Whether this is the primary site. */
  isPrimary: Maybe<Scalars['Boolean']['output']>;
};

/** Social media link configuration. */
export type ConfigSocial = {
  __typename?: 'ConfigSocial';
  /** Social media platform identifier. */
  id: Scalars['String']['output'];
  /** Display title for the social link. */
  title: Maybe<Scalars['String']['output']>;
  /** Social media URL or value. */
  value: Maybe<Scalars['String']['output']>;
};

/** Tax configuration. */
export type ConfigTaxes = {
  __typename?: 'ConfigTaxes';
  /** Tax calculation rules. */
  rules: ConfigTaxesRules;
};

/** Tax calculation rules. */
export type ConfigTaxesRules = {
  __typename?: 'ConfigTaxesRules';
  /** Whether prices can be edited before taxes are applied. */
  editPricesBeforeTaxes: Maybe<Scalars['Boolean']['output']>;
  /** Whether to show prices before taxes are applied. */
  showPricesBeforeTaxes: Maybe<Scalars['Boolean']['output']>;
};

/** Item descriptions in multiple formats for display purposes. */
export type Descriptions = {
  __typename?: 'Descriptions';
  /** Main description text. */
  main: Scalars['String']['output'];
  /** Shop-specific description variants. */
  shop: Maybe<ShopDescriptions>;
};

/** E-shop configuration including theme, checkout, and preferences. */
export type Eshop = {
  __typename?: 'Eshop';
  /** Checkout configuration. */
  checkout: EshopCheckout;
  /** Head section configuration. */
  head: Maybe<ConfigEshopHead>;
  /** Navigation menus in JSON format. */
  menus: Array<Scalars['JSON']['output']>;
  /** E-shop preferences and feature settings. */
  preferences: ConfigEshopPreferences;
  /** SEO configuration. */
  seo: Maybe<ConfigEshopSeo>;
  /** Base URI for the e-shop. */
  uri: Maybe<Scalars['String']['output']>;
};

/** Checkout configuration settings. */
export type EshopCheckout = {
  __typename?: 'EshopCheckout';
  /** Available payment methods. */
  paymentMethods: Maybe<EshopCheckoutPaymentMethods>;
  /** Checkout version number. */
  version: Maybe<Scalars['Int']['output']>;
};

/** Flitt payment method configuration. */
export type EshopCheckoutPaymentFlitt = {
  __typename?: 'EshopCheckoutPaymentFlitt';
  /** Whether Flitt is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
};

/** Iyzipay payment method configuration. */
export type EshopCheckoutPaymentIyzipay = {
  __typename?: 'EshopCheckoutPaymentIyzipay';
  /** Whether Iyzipay is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
};

/** Available payment methods for checkout. */
export type EshopCheckoutPaymentMethods = {
  __typename?: 'EshopCheckoutPaymentMethods';
  /** Cash in advance payment method. */
  cashInAdvance: Maybe<EshopCheckoutPaymentMethodsCashInAdvance>;
  /** Flitt payment method. */
  flitt: Maybe<EshopCheckoutPaymentFlitt>;
  /** Iyzipay payment method. */
  iyzipay: Maybe<EshopCheckoutPaymentIyzipay>;
  /**
   * Payze payment method.
   * @deprecated Field no longer supported
   */
  payze: Maybe<EshopCheckoutPaymentPayze>;
  /** Stripe payment method. */
  stripe: Maybe<EshopCheckoutPaymentStripe>;
};

/** Cash in advance payment method configuration. */
export type EshopCheckoutPaymentMethodsCashInAdvance = {
  __typename?: 'EshopCheckoutPaymentMethodsCashInAdvance';
  /** Notes or instructions for cash in advance payments. */
  notes: Maybe<Scalars['String']['output']>;
  /** Whether cash in advance is enabled. */
  status: Maybe<Scalars['Boolean']['output']>;
};

/** Payze payment method configuration. */
export type EshopCheckoutPaymentPayze = {
  __typename?: 'EshopCheckoutPaymentPayze';
  /** Whether Payze is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
};

/** Stripe payment method configuration. */
export type EshopCheckoutPaymentStripe = {
  __typename?: 'EshopCheckoutPaymentStripe';
  /** Whether Stripe is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
  /** Stripe publishable API key. */
  publishableKey: Maybe<Scalars['String']['output']>;
};

/** Represents an analytics or tracking event. */
export type Event = {
  __typename?: 'Event';
  /** Date when the event was created. */
  createdAt: Maybe<Scalars['Date']['output']>;
  /** Unique identifier for the event. */
  id: Maybe<Scalars['ID']['output']>;
  /** Reference identifier for the related resource. */
  ref: Maybe<Scalars['ID']['output']>;
  /** Type of event. */
  type: Maybe<Scalars['String']['output']>;
};

/** A single filter option result with match count. */
export type FilterResult = {
  __typename?: 'FilterResult';
  /** Unique identifier for the filter option. */
  _id: Scalars['String']['output'];
  /** Numeric identifier for the filter option. */
  id: Maybe<Scalars['Float']['output']>;
  /** Number of items matching this filter option. */
  matches: Scalars['Float']['output'];
  /** Whether this filter option is currently selected. */
  selected: Maybe<Scalars['Boolean']['output']>;
};

/** Google integration configuration. */
export type Google = {
  __typename?: 'Google';
  /** Google Analytics configuration. */
  analytics: Maybe<GoogleAnalytics>;
  /** Google Tag Manager configuration. */
  gtm: Maybe<GoogleGtm>;
};

/** Google Analytics configuration. */
export type GoogleAnalytics = {
  __typename?: 'GoogleAnalytics';
  /** Analytics property configuration. */
  property: Maybe<GoogleAnatyticsProperty>;
  /** Analytics view configuration. */
  view: Maybe<GoogleAnalyticsView>;
};

/** Google Analytics view configuration. */
export type GoogleAnalyticsView = {
  __typename?: 'GoogleAnalyticsView';
  /** Analytics view identifier. */
  id: Maybe<Scalars['String']['output']>;
  /** Name of the Analytics view. */
  name: Maybe<Scalars['String']['output']>;
};

/** Google Analytics property configuration. */
export type GoogleAnatyticsProperty = {
  __typename?: 'GoogleAnatyticsProperty';
  /** Analytics property identifier. */
  id: Maybe<Scalars['String']['output']>;
  /** Name of the Analytics property. */
  name: Maybe<Scalars['String']['output']>;
  /** Tracker identifier. */
  tracker: Maybe<Scalars['String']['output']>;
};

/** Google Tag Manager configuration. */
export type GoogleGtm = {
  __typename?: 'GoogleGtm';
  /** Google Tag Manager container identifier. */
  id: Maybe<Scalars['String']['output']>;
};

/** Image associated with an item. */
export type Image = {
  __typename?: 'Image';
  /** Alternative image representation. */
  alternative: Maybe<ImageAlternative>;
  /** URI to the image. */
  uri: Maybe<Scalars['String']['output']>;
};

/** Alternative image representation. */
export type ImageAlternative = {
  __typename?: 'ImageAlternative';
  /** URI to the alternative image. */
  uri: Maybe<Scalars['String']['output']>;
};

/** Paginated inventory results with items and filter metadata. */
export type Inventory = {
  __typename?: 'Inventory';
  /** Applied filter values in JSON format. */
  filters: Maybe<Scalars['JSON']['output']>;
  /** List of items in the current page. */
  items: Array<Item>;
  /** Pagination metadata for the results. */
  pagination: Pagination;
};

/** Input filters for querying inventory items. */
export type InventoryFiltersInput = {
  /** Filter by artist identifiers. */
  artists?: InputMaybe<Array<Scalars['Float']['input']>>;
  /** Filter by category names. */
  categories?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Filter for items with a compare-at price set. */
  compareAtPrice?: InputMaybe<Scalars['Boolean']['input']>;
  /** Filter by item condition. */
  condition?: InputMaybe<Scalars['String']['input']>;
  /** Filter by country codes. */
  countries?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Filter by format descriptions. */
  formatDescriptions?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Filter by format names. */
  formats?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Lower bound for price range filter. */
  from?: InputMaybe<Scalars['String']['input']>;
  /** Filter by musical genres. */
  genres?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Filter by multiple item types. */
  itemTypes?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Filter by label identifiers. */
  labels?: InputMaybe<Array<Scalars['Float']['input']>>;
  /** Filter by manufacturer names. */
  manufacturers?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Maximum price filter. */
  maxPrice?: InputMaybe<Scalars['Int']['input']>;
  /**
   * Filter by medium types.
   * @deprecated Field no longer supported
   */
  mediums?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Return all items without applying any filters. */
  noFilters?: InputMaybe<Scalars['Boolean']['input']>;
  /** Filter for pre-order items only. */
  preorder?: InputMaybe<Scalars['Boolean']['input']>;
  /** Filter for pre-order status (e.g., "all", "available"). */
  preorders?: InputMaybe<Scalars['String']['input']>;
  /** Filter by stock status (e.g., "inStock", "outOfStock"). */
  stock?: InputMaybe<Scalars['String']['input']>;
  /** Filter by musical styles. */
  styles?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Upper bound for price range filter. */
  to?: InputMaybe<Scalars['String']['input']>;
  /** Filter by item type. */
  type?: InputMaybe<Scalars['String']['input']>;
  /** Filter by format types. */
  types?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Filter for items in the user's wantlist. */
  wantlist?: InputMaybe<Scalars['Boolean']['input']>;
  /** Filter by release years. */
  years?: InputMaybe<Array<Scalars['Int']['input']>>;
};

/** Paginated filter options for inventory filtering. */
export type InventoryFiltersPagination = {
  __typename?: 'InventoryFiltersPagination';
  /** List of filter groups with their options. */
  filters: Array<InventoryFiltersPaginationFilter>;
  /** Total number of pages for filter options. */
  pages: Scalars['Int']['output'];
};

/** A filter group with its options and metadata. */
export type InventoryFiltersPaginationFilter = {
  __typename?: 'InventoryFiltersPaginationFilter';
  /** Unique identifier for the filter. */
  id: Scalars['String']['output'];
  /** Filter key name. */
  key: Scalars['String']['output'];
  /** Layout type for displaying the filter. */
  layout: Scalars['String']['output'];
  /** Available filter options with match counts. */
  options: Array<FilterResult>;
  /** Type of filter (e.g., "range", "select", "multiselect"). */
  type: Scalars['String']['output'];
};

/** Paginated inventory items with pagination metadata. */
export type InventoryItems = {
  __typename?: 'InventoryItems';
  /** List of items in the current page. */
  items: Array<Item>;
  /** Pagination metadata for the results. */
  pagination: Pagination;
};

/** Represents an inventory item (release, book, or product) with listings and metadata. */
export type Item = {
  __typename?: 'Item';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Shortened URL via Bitly. */
  bitly: Maybe<Scalars['String']['output']>;
  /** Date when the item was created. */
  created: Maybe<Scalars['Date']['output']>;
  /** Detailed item data and metadata. */
  data: ItemData;
  /** Item descriptions in multiple formats. */
  descriptions: Descriptions;
  /**
   * URL-friendly handle for the item.
   * @deprecated Field no longer supported
   */
  handle: Maybe<Scalars['String']['output']>;
  /** Numeric identifier for the item. */
  id: Scalars['Float']['output'];
  /** Whether the item is forbidden for sale. */
  isForbiddenForSale: Maybe<Scalars['Boolean']['output']>;
  /** Available listings for this item. */
  listings: Array<Listing>;
  /** URL path to the item page. */
  path: Scalars['String']['output'];
  /** SEO metadata for the item. */
  seo: Maybe<SeoEntry>;
  /** Item type (e.g., "release", "book", "product"). */
  type: Scalars['String']['output'];
  /** URI identifier for the item. */
  uri: Scalars['String']['output'];
  /** Whether the item is in the user's wantlist. */
  wanted: Maybe<Scalars['Boolean']['output']>;
};

/** Artist information associated with an item. */
export type ItemArtist = {
  __typename?: 'ItemArtist';
  /** Artist name variation (ANV - Artist Name Variation). */
  anv: Maybe<Scalars['String']['output']>;
  /** External identifier for the artist. */
  id: Maybe<Scalars['Float']['output']>;
  /** Join phrase connecting multiple artists. */
  join: Maybe<Scalars['String']['output']>;
  /** Artist name. */
  name: Scalars['String']['output'];
};

/** Detailed data and metadata for an item, including release, book, or product information. */
export type ItemData = {
  __typename?: 'ItemData';
  /** Artists associated with the item. */
  artists: Maybe<Array<ItemArtist>>;
  /** Link to associated digital asset. */
  assetLink: Maybe<Scalars['String']['output']>;
  /** Authors for book items. */
  authors: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  /** Category classification. */
  cat: Maybe<Scalars['String']['output']>;
  /** Categories the item belongs to. */
  categories: Maybe<Array<Scalars['String']['output']>>;
  /** Country of origin or release. */
  country: Maybe<Scalars['String']['output']>;
  /** External identifier from the marketplace system. */
  discogsId: Maybe<Scalars['Float']['output']>;
  /** Format description for book items. */
  format: Maybe<Scalars['String']['output']>;
  /** Format information for release items. */
  formats: Maybe<Array<ReleaseFormat>>;
  /** Musical genres associated with the item. */
  genres: Maybe<Array<Scalars['String']['output']>>;
  /** Identifiers associated with the item (e.g., barcodes, catalog numbers). */
  identifiers: Maybe<Array<ItemIdentifier>>;
  /** Images associated with the item. */
  images: Array<Image>;
  /**
   * Industry identifiers for book items (e.g., ISBN).
   * @deprecated Field no longer supported
   */
  industryIdentifiers: Maybe<Array<Maybe<BookIndustryIdentifier>>>;
  /** Labels associated with the item. */
  labels: Maybe<Array<ItemLabel>>;
  /** Language of the item. */
  language: Maybe<Scalars['String']['output']>;
  /** Manufacturer name. */
  manufacturer: Maybe<Scalars['String']['output']>;
  /** Maturity rating for book items. */
  maturityRating: Maybe<Scalars['String']['output']>;
  /** Number of pages for book items. */
  pageCount: Maybe<Scalars['Int']['output']>;
  /** Publication date for book items. */
  publishedDate: Maybe<Scalars['Date']['output']>;
  /** Publisher for book items. */
  publisher: Maybe<Scalars['String']['output']>;
  /** Release date for release items. */
  releaseDate: Maybe<Scalars['Date']['output']>;
  /** Musical styles associated with the item. */
  styles: Maybe<Array<Scalars['String']['output']>>;
  /** Subtitle for book items. */
  subtitle: Maybe<Scalars['String']['output']>;
  /** Title of the item. */
  title: Maybe<Scalars['String']['output']>;
  /** Track listing for release items. */
  tracklist: Maybe<Array<Track>>;
  /** Item type (e.g., "release", "book", "product"). */
  type: Maybe<Scalars['String']['output']>;
  /** Videos associated with the item. */
  videos: Maybe<Array<Maybe<ItemVideo>>>;
  /** Weight of the item. */
  weight: Maybe<Scalars['Float']['output']>;
};

/** Generic identifier for an item (e.g., barcode, catalog number). */
export type ItemIdentifier = {
  __typename?: 'ItemIdentifier';
  /** Description of the identifier. */
  description: Maybe<Scalars['String']['output']>;
  /** Type of identifier. */
  type: Maybe<Scalars['String']['output']>;
  /** The identifier value. */
  value: Maybe<Scalars['String']['output']>;
};

/** Label information associated with an item. */
export type ItemLabel = {
  __typename?: 'ItemLabel';
  /** Label name variation (ANV). */
  anv: Maybe<Scalars['String']['output']>;
  /** Catalog number assigned by the label. */
  catno: Maybe<Scalars['String']['output']>;
  /** External identifier for the label. */
  id: Maybe<Scalars['Float']['output']>;
  /** Label name. */
  name: Scalars['String']['output'];
};

/** Video associated with an item. */
export type ItemVideo = {
  __typename?: 'ItemVideo';
  /** URI to the video. */
  uri: Maybe<Scalars['String']['output']>;
};

/** Represents a record label with profile information, images, and metadata. */
export type Label = {
  __typename?: 'Label';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Country of origin for the label. */
  country: Maybe<LabelCountry>;
  /** Date when the label record was created. */
  createdAt: Maybe<Scalars['Date']['output']>;
  /** External identifier from the marketplace system. */
  discogsId: Maybe<Scalars['Int']['output']>;
  /** Numeric identifier for the label. */
  id: Scalars['Float']['output'];
  /** Images associated with the label. */
  images: Maybe<Array<LabelImage>>;
  /** Date when the label record was last modified. */
  modifiedAt: Maybe<Scalars['Date']['output']>;
  /** Label name. */
  name: Scalars['String']['output'];
  /** Biography or profile text for the label. */
  profile: Maybe<Scalars['String']['output']>;
  /** Sub-labels or imprints associated with this label. */
  subLabels: Maybe<Array<LabelSub>>;
  /** Tags associated with the label. */
  tags: Maybe<Array<Scalars['String']['output']>>;
  /** Official websites for the label. */
  websites: Maybe<Array<Scalars['String']['output']>>;
};

/** Country information for a label. */
export type LabelCountry = {
  __typename?: 'LabelCountry';
  /** Two-letter ISO country code. */
  alpha2: Maybe<Scalars['String']['output']>;
  /** Country name. */
  name: Maybe<Scalars['String']['output']>;
};

/** Image associated with a label. */
export type LabelImage = {
  __typename?: 'LabelImage';
  /** URI to the thumbnail image. */
  thumbnail: Maybe<Scalars['String']['output']>;
  /** URI to the full-size image. */
  uri: Maybe<Scalars['String']['output']>;
};

/** Sub-label or imprint associated with a parent label. */
export type LabelSub = {
  __typename?: 'LabelSub';
  /** External identifier for the sub-label. */
  id: Maybe<Scalars['Float']['output']>;
  /** Name of the sub-label. */
  name: Maybe<Scalars['String']['output']>;
};

/** A listing represents a specific variant of an item available for purchase. */
export type Listing = {
  __typename?: 'Listing';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Date when the item becomes available for purchase. */
  available: Maybe<Scalars['Date']['output']>;
  /** Categories this listing belongs to. */
  categories: Array<Scalars['String']['output']>;
  /** Additional comments or notes about the listing. */
  comments: Maybe<Scalars['String']['output']>;
  /** Numeric identifier for the listing. */
  id: Scalars['Float']['output'];
  /** Whether only one item per customer is allowed. */
  onePerCustomer: Maybe<Scalars['Boolean']['output']>;
  /** Product option variants for this listing. */
  options: Array<Option>;
  /** Whether this is a pre-order listing. */
  preOrder: Maybe<Scalars['Boolean']['output']>;
  /** Pricing information for this listing. */
  prices: Prices;
  /** Whether this is a second-hand item. */
  secondHand: Maybe<Scalars['Boolean']['output']>;
  /** Stock quantity information. */
  stock: Stock;
};

/** Response from a login operation. */
export type LoginResponse = {
  __typename?: 'LoginResponse';
  /** Associated checkout if one exists. */
  checkout: Maybe<Checkout>;
  /** Created session for the authenticated user. */
  session: Maybe<Session>;
  /** Total number of active sessions for the user. */
  sessionsCount: Maybe<Scalars['Int']['output']>;
};

/** Response from a logout operation. */
export type LogoutResponse = {
  __typename?: 'LogoutResponse';
  /** Associated checkout if one exists. */
  checkout: Maybe<Checkout>;
  /** Whether the logout was successful. */
  ok: Maybe<Scalars['Boolean']['output']>;
};

/** Represents a media file with metadata and multiple format variants. */
export type Media = {
  __typename?: 'Media';
  /** Internal database identifier. */
  _id: Maybe<Scalars['ID']['output']>;
  /** Alternative text for accessibility. */
  alt: Maybe<Scalars['String']['output']>;
  /** Caption text for the media. */
  caption: Maybe<Scalars['String']['output']>;
  /** Date when the media was created. */
  created: Maybe<Scalars['Date']['output']>;
  /** File extension. */
  ext: Maybe<Scalars['String']['output']>;
  /** Array of all available format variants. */
  formatArray: Maybe<Array<MediaFormat>>;
  /** Organized collection of format variants by size. */
  formats: Maybe<MediaFormats>;
  /** Height of the media in pixels. */
  height: Maybe<Scalars['Int']['output']>;
  /** Numeric identifier for the media item. */
  id: Maybe<Scalars['Int']['output']>;
  /** MIME type of the media file. */
  mime: Maybe<Scalars['String']['output']>;
  /** File size in bytes. */
  size: Maybe<Scalars['Int']['output']>;
  /** Title of the media file. */
  title: Maybe<Scalars['String']['output']>;
  /** URL to access the original media file. */
  url: Maybe<Scalars['String']['output']>;
  /** Width of the media in pixels. */
  width: Maybe<Scalars['Int']['output']>;
};

/** A specific format variant of a media file with dimensions and URL. */
export type MediaFormat = {
  __typename?: 'MediaFormat';
  /** Internal database identifier. */
  _id: Maybe<Scalars['ID']['output']>;
  /** Height of the media in pixels. */
  height: Maybe<Scalars['Int']['output']>;
  /** Name of the format variant. */
  name: Maybe<Scalars['String']['output']>;
  /** File size in bytes. */
  size: Maybe<Scalars['Int']['output']>;
  /** URL to access the formatted media file. */
  url: Maybe<Scalars['String']['output']>;
  /** Width of the media in pixels. */
  width: Maybe<Scalars['Int']['output']>;
};

/** Collection of different format variants for a media file. */
export type MediaFormats = {
  __typename?: 'MediaFormats';
  /** Banner-sized format variant. */
  banner: Maybe<MediaFormat>;
  /** Large-sized format variant. */
  large: Maybe<MediaFormat>;
  /** Small-sized format variant. */
  small: Maybe<MediaFormat>;
  /** Square format variant. */
  square: Maybe<MediaFormat>;
  /** Thumbnail-sized format variant. */
  thumbnail: Maybe<MediaFormat>;
};

/** A message in an order conversation thread. */
export type Message = {
  __typename?: 'Message';
  /** Attachments included with the message. */
  attachments: Maybe<Array<OrderMessageAttachment>>;
  /** Message content text. */
  content: Maybe<Scalars['String']['output']>;
  /** Date when the message was created. */
  created: Maybe<Scalars['Date']['output']>;
  /** Whether the message was sent by the buyer. */
  fromBuyer: Maybe<Scalars['Boolean']['output']>;
  /** Sender information. */
  sender: Maybe<OrderMessageSender>;
  /** Message subject line. */
  subject: Maybe<Scalars['String']['output']>;
};

/** Meta (Facebook) integration configuration. */
export type Meta = {
  __typename?: 'Meta';
  /** Meta Pixel configuration. */
  pixel: Maybe<MetaPixel>;
};

/** Meta Pixel tracking configuration. */
export type MetaPixel = {
  __typename?: 'MetaPixel';
  /** Whether the Meta Pixel is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
  /** Meta Pixel identifier. */
  id: Maybe<Scalars['String']['output']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  /** Applies a voucher to a checkout. */
  addVoucher: Checkout;
  /** Deactivates the current buyer account. */
  buyerDeactivate: Maybe<Scalars['String']['output']>;
  /** Associates a user account with a checkout. */
  checkoutAssociateUser: Maybe<Checkout>;
  /** Creates a new checkout session. */
  checkoutCreate: Maybe<Checkout>;
  /** Disassociates a user account from a checkout. */
  checkoutDisassociateUser: Maybe<Checkout>;
  /** Updates checkout information including billing, shipping, and buyer details. */
  checkoutUpdate: Maybe<Checkout>;
  /** Updates billing and shipping addresses for a checkout. */
  checkoutUpdateAddresses: Maybe<Checkout>;
  /** Updates checkout items in the existing checkout. */
  checkoutUpdateItems: Maybe<Checkout>;
  /** Verifies checkout validity and throws an error if invalid. */
  checkoutVerifyAndThrow: Maybe<Checkout>;
  /** Verifies checkout validity and updates it if needed. */
  checkoutVerifyAndUpdate: Maybe<CheckoutVerifyAndUpdateResponse>;
  /**
   * Submits a customer contact request (currently an order withdrawal / cancellation). Records it as
   * an internal message visible in the Backoffice and notifies the shop admins.
   */
  contact: Maybe<Scalars['String']['output']>;
  /** Records an analytics or tracking event. */
  event: Maybe<Scalars['String']['output']>;
  /** Archives audio snippets for an item. */
  itemSnippetsArchive: Scalars['String']['output'];
  /** Subscribes an email address to a customer list. */
  listOptin: Maybe<Scalars['String']['output']>;
  /** Unsubscribes an email address from a customer list. */
  listOptout: Maybe<Scalars['String']['output']>;
  /** Authenticates a user with email and password. */
  login: Maybe<LoginResponse>;
  /** Logs out the current user session. */
  logout: Maybe<LogoutResponse>;
  /** Adds a message to an order conversation thread. */
  orderAddMessage: Maybe<Order>;
  /** Records a play count for an audio track. */
  playCount: Maybe<Scalars['String']['output']>;
  /** Registers a new user account. */
  register: Maybe<RegisterResponse>;
  /**
   * Registers an analytics or tracking event.
   * @deprecated Field no longer supported
   */
  registerEvent: Maybe<Event>;
  /** Removes a voucher from a checkout. */
  removeVoucher: Checkout;
  /** Creates a password reset token for a user. */
  userCreatePasswordToken: Maybe<Scalars['String']['output']>;
  /** Creates a verification request for a user account. */
  userCreateVerification: User;
  /** Resets a user's password using a reset token. */
  userPasswordReset: Maybe<Scalars['String']['output']>;
  /** Updates the current user's account information. */
  userUpdate: Maybe<User>;
  /** Verifies a user account using a token or verification code. */
  userVerify: Maybe<UserVerifyResponse>;
  /** Verifies a password reset token and returns the user. */
  userVerifyPasswordToken: Maybe<User>;
  /** Validates a voucher code for a checkout. */
  validateVoucher: Maybe<CheckoutVoucher>;
  /** Adds an item to the user's wantlist. */
  want: Maybe<Item>;
};


export type MutationAddVoucherArgs = {
  id: Scalars['String']['input'];
  voucherId: Scalars['String']['input'];
};


export type MutationCheckoutAssociateUserArgs = {
  data: InputMaybe<Scalars['JSON']['input']>;
  id: Scalars['String']['input'];
};


export type MutationCheckoutDisassociateUserArgs = {
  id: Scalars['String']['input'];
};


export type MutationCheckoutUpdateArgs = {
  billing: InputMaybe<CheckoutBillingInput>;
  buyer: InputMaybe<CheckoutBuyerInput>;
  createAccount: InputMaybe<Scalars['Boolean']['input']>;
  id: Scalars['String']['input'];
  shipping: InputMaybe<CheckoutShippingInput>;
  useSingleAddress: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationCheckoutUpdateAddressesArgs = {
  billing: InputMaybe<CheckoutBillingInput>;
  id: Scalars['String']['input'];
  shipping: InputMaybe<CheckoutShippingInput>;
};


export type MutationCheckoutUpdateItemsArgs = {
  id: Scalars['String']['input'];
  items: InputMaybe<Array<InputMaybe<CheckoutItemInput>>>;
};


export type MutationCheckoutVerifyAndThrowArgs = {
  id: Scalars['String']['input'];
};


export type MutationCheckoutVerifyAndUpdateArgs = {
  id: Scalars['String']['input'];
};


export type MutationContactArgs = {
  withdrawal: InputMaybe<WithdrawalInput>;
};


export type MutationEventArgs = {
  event: Scalars['String']['input'];
  meta: Scalars['JSON']['input'];
};


export type MutationItemSnippetsArchiveArgs = {
  id: Scalars['Float']['input'];
};


export type MutationListOptinArgs = {
  email: Scalars['String']['input'];
  listRef: Scalars['ID']['input'];
};


export type MutationListOptoutArgs = {
  email: Scalars['String']['input'];
  listRef: Scalars['ID']['input'];
  reason: Scalars['String']['input'];
};


export type MutationLoginArgs = {
  checkoutId: InputMaybe<Scalars['String']['input']>;
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
};


export type MutationLogoutArgs = {
  checkoutId: InputMaybe<Scalars['String']['input']>;
};


export type MutationOrderAddMessageArgs = {
  id: Scalars['String']['input'];
  message: Scalars['String']['input'];
};


export type MutationPlayCountArgs = {
  id: Scalars['Float']['input'];
  position: Scalars['String']['input'];
};


export type MutationRegisterArgs = {
  addresses: InputMaybe<Array<AddressInput>>;
  email: Scalars['String']['input'];
  firstName: Scalars['String']['input'];
  lastName: Scalars['String']['input'];
  organisation: InputMaybe<Scalars['String']['input']>;
  password: Scalars['String']['input'];
  taxNumber: InputMaybe<Scalars['String']['input']>;
  telephone: InputMaybe<Scalars['String']['input']>;
  withVerificationCode: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationRegisterEventArgs = {
  data: Scalars['JSON']['input'];
  type: Scalars['String']['input'];
};


export type MutationRemoveVoucherArgs = {
  id: Scalars['String']['input'];
};


export type MutationUserCreatePasswordTokenArgs = {
  email: Scalars['String']['input'];
  withVerificationCode: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationUserCreateVerificationArgs = {
  email: Scalars['String']['input'];
  withVerificationCode: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationUserPasswordResetArgs = {
  password: Scalars['String']['input'];
  token: Scalars['String']['input'];
};


export type MutationUserUpdateArgs = {
  addresses: InputMaybe<Array<InputMaybe<AddressInput>>>;
  email: InputMaybe<Scalars['String']['input']>;
  firstName: InputMaybe<Scalars['String']['input']>;
  lastName: InputMaybe<Scalars['String']['input']>;
  organisation: InputMaybe<Scalars['String']['input']>;
  password: InputMaybe<Scalars['String']['input']>;
  preferences: InputMaybe<Scalars['JSON']['input']>;
  taxNumber: InputMaybe<Scalars['String']['input']>;
  telephone: InputMaybe<Scalars['String']['input']>;
};


export type MutationUserVerifyArgs = {
  checkoutId: InputMaybe<Scalars['String']['input']>;
  code: InputMaybe<Scalars['Int']['input']>;
  email: InputMaybe<Scalars['String']['input']>;
  token: InputMaybe<Scalars['String']['input']>;
};


export type MutationUserVerifyPasswordTokenArgs = {
  token: Scalars['String']['input'];
};


export type MutationValidateVoucherArgs = {
  id: Scalars['String']['input'];
  voucherId: Scalars['String']['input'];
};


export type MutationWantArgs = {
  id: Scalars['Float']['input'];
};

/** A product option variant (e.g., size, color). */
export type Option = {
  __typename?: 'Option';
  /** Name of the option (e.g., "Size", "Color"). */
  name: Scalars['String']['output'];
  /** Value of the option (e.g., "Large", "Red"). */
  value: Scalars['String']['output'];
};

/** Represents a customer order with items, billing, shipping, and payment information. */
export type Order = {
  __typename?: 'Order';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Billing information and payment details. */
  billing: CheckoutBilling;
  /** Buyer information. */
  buyer: Maybe<User>;
  /** Configuration reference for the shop. */
  configRef: Maybe<Scalars['ID']['output']>;
  /** Date when the order was created. */
  created: Maybe<Scalars['Date']['output']>;
  /** Order identifier string. */
  id: Scalars['String']['output'];
  /** Items included in the order. */
  items: Array<CheckoutLineItem>;
  /** Messages in the order conversation thread. */
  messages: Maybe<Array<Message>>;
  /** Origin of the order (e.g., "Online"). */
  origin: Scalars['String']['output'];
  /** URL for payment processing if payment is pending. */
  paymentUrl: Maybe<Scalars['String']['output']>;
  /** Shipping information and method. */
  shipping: CheckoutShipping;
  /** Current status of the order. */
  status: Scalars['String']['output'];
  /** Order totals including subtotals, taxes, and shipping. */
  totals: CheckoutTotals;
};

/** Attachment associated with an order message. */
export type OrderMessageAttachment = {
  __typename?: 'OrderMessageAttachment';
  /** Internal database identifier. */
  _id: Maybe<Scalars['ID']['output']>;
  /** Title of the attachment. */
  title: Maybe<Scalars['String']['output']>;
  /** URI to the attachment file. */
  uri: Maybe<Scalars['String']['output']>;
};

/** Sender information for an order message. */
export type OrderMessageSender = {
  __typename?: 'OrderMessageSender';
  /** Alias or display name of the sender. */
  alias: Maybe<Scalars['String']['output']>;
  /** Name of the message sender. */
  name: Maybe<Scalars['String']['output']>;
};

/** Pagination metadata for paginated query results. */
export type Pagination = {
  __typename?: 'Pagination';
  /** Total number of items across all pages. */
  count: Maybe<Scalars['Int']['output']>;
  /** Whether there are more pages available. */
  hasMore: Maybe<Scalars['Boolean']['output']>;
  /** Number of items per page. */
  limit: Maybe<Scalars['Int']['output']>;
  /** Sort order (1 for ascending, -1 for descending). */
  order: Maybe<Scalars['Int']['output']>;
  /** Current page number. */
  page: Scalars['Int']['output'];
  /** Total number of pages. */
  pages: Scalars['Int']['output'];
  /** Field name used for sorting. */
  sort: Maybe<Scalars['String']['output']>;
};

/** Input parameters for pagination and sorting. */
export type PaginationInput = {
  /** Number of items per page. Your requested size is used if it does not exceed the server-enforced maximum limit. */
  limit?: InputMaybe<Scalars['Int']['input']>;
  /** Sort order (1 for ascending, -1 for descending). */
  order?: InputMaybe<Scalars['Int']['input']>;
  /** The requested page number. Defaults to 1 if not specified. */
  page?: InputMaybe<Scalars['Int']['input']>;
  /** Field name to sort by. */
  sort?: InputMaybe<Scalars['String']['input']>;
};

/** Represents a curated playlist of items. */
export type Playlist = {
  __typename?: 'Playlist';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Playlist entries with items and comments. */
  entries: Array<PlaylistEntry>;
  /** Numeric identifier for the playlist. */
  id: Scalars['Int']['output'];
  /** Items in the playlist (deprecated, use entries instead). */
  items: Maybe<Array<Maybe<Item>>>;
  /** URL link to the playlist. */
  link: Maybe<Scalars['String']['output']>;
  /** Title of the playlist. */
  title: Maybe<Scalars['String']['output']>;
};

/** A single item entry within a playlist with optional comments. */
export type PlaylistEntry = {
  __typename?: 'PlaylistEntry';
  /** Optional comments about this item in the playlist. */
  comments: Maybe<Scalars['String']['output']>;
  /** The item in the playlist. */
  item: Item;
};

/** Pricing information for a listing. */
export type Prices = {
  __typename?: 'Prices';
  /** Price before taxes are applied. */
  beforeTaxes: Maybe<Scalars['Float']['output']>;
  /** Original price for comparison (strikethrough price). */
  compare: Maybe<Scalars['Float']['output']>;
  /** Current sale price. */
  sale: Scalars['Float']['output'];
};

export type Query = {
  __typename?: 'Query';
  /** Retrieves a single article by ID, homepage flag, or handle. */
  article: Maybe<Article>;
  /** Retrieves a list of articles with optional filtering and sorting. */
  articles: Array<Article>;
  /** Retrieves a list of artists, optionally filtered by letter. */
  artists: Array<Artist>;
  /** Retrieves a checkout by identifier. */
  checkout: Maybe<Checkout>;
  /** Retrieves a collection with its first page of items. */
  collection: Maybe<CollectionWithData>;
  /** Retrieves a collection with paginated items. */
  collectionItems: Maybe<CollectionItems>;
  /** Retrieves pagination metadata for a collection. */
  collectionPagination: Pagination;
  /** Retrieves shop configuration for a storefront by domain, configuration reference, or theme reference. */
  config: Maybe<Config>;
  /** Retrieves country data in JSON format. */
  countries: Maybe<Scalars['JSON']['output']>;
  /**
   * Retrieves a paginated inventory with filtering options.
   * @deprecated Use inventoryItems with inventoryFiltersPagination instead
   */
  inventory: Maybe<Inventory>;
  /** Retrieves paginated filter options for inventory filtering. */
  inventoryFiltersPagination: InventoryFiltersPagination;
  /** Retrieves paginated inventory items with filtering. */
  inventoryItems: InventoryItems;
  /** Retrieves a single item by numeric ID or database reference. */
  item: Maybe<Item>;
  /** Retrieves multiple items by their numeric IDs. */
  items: Array<Item>;
  /** Retrieves a list of labels, optionally filtered by letter. */
  labels: Array<Label>;
  /** Retrieves a single order by ID with optional status filter. */
  order: Maybe<Order>;
  /** Retrieves a paginated list of orders for the current user. */
  orders: Array<Order>;
  /** Retrieves a playlist by numeric ID. */
  playlist: Maybe<Playlist>;
  /** Searches for items matching the search term. */
  search: Maybe<SearchResponse>;
  /** Retrieves the current user session. */
  session: Maybe<Session>;
  /** Retrieves item suggestions based on filters and criteria. */
  suggestions: Maybe<Array<Item>>;
  /** Retrieves the currently authenticated user. */
  user: Maybe<User>;
  /** Retrieves a user by password reset token. */
  userPasswordSession: Maybe<User>;
};


export type QueryArticleArgs = {
  handle: InputMaybe<Scalars['String']['input']>;
  homepage: InputMaybe<Scalars['Boolean']['input']>;
  id: InputMaybe<Scalars['Int']['input']>;
  preview: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryArticlesArgs = {
  limit: InputMaybe<Scalars['Int']['input']>;
  sortBy: InputMaybe<Scalars['String']['input']>;
  sortOrder: InputMaybe<Scalars['Int']['input']>;
  tags: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tagsOperator: InputMaybe<Scalars['String']['input']>;
  type: InputMaybe<Scalars['String']['input']>;
};


export type QueryArtistsArgs = {
  letter: InputMaybe<Scalars['String']['input']>;
};


export type QueryCheckoutArgs = {
  id: Scalars['String']['input'];
};


export type QueryCollectionArgs = {
  handle: InputMaybe<Scalars['String']['input']>;
  id: InputMaybe<Scalars['Int']['input']>;
  limit: InputMaybe<Scalars['Int']['input']>;
  order: InputMaybe<Scalars['Int']['input']>;
  page: InputMaybe<Scalars['Int']['input']>;
  randomise: InputMaybe<Scalars['Boolean']['input']>;
  sort: InputMaybe<Scalars['String']['input']>;
};


export type QueryCollectionItemsArgs = {
  id: Scalars['Int']['input'];
  pagination: PaginationInput;
  randomise: Scalars['Boolean']['input'];
};


export type QueryCollectionPaginationArgs = {
  id: Scalars['Int']['input'];
  pagination: PaginationInput;
};


export type QueryConfigArgs = {
  configRef: InputMaybe<Scalars['ID']['input']>;
  domain: InputMaybe<Scalars['String']['input']>;
  themeRef: InputMaybe<Scalars['ID']['input']>;
};


export type QueryInventoryArgs = {
  artists: InputMaybe<Array<InputMaybe<Scalars['Float']['input']>>>;
  categories: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  condition: InputMaybe<Scalars['String']['input']>;
  countries: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  formats: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  from: InputMaybe<Scalars['String']['input']>;
  genres: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  itemTypes: InputMaybe<Array<Scalars['String']['input']>>;
  labels: InputMaybe<Array<InputMaybe<Scalars['Float']['input']>>>;
  limit: InputMaybe<Scalars['Int']['input']>;
  manufacturers: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  maxPrice: InputMaybe<Scalars['Int']['input']>;
  mediums: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  noFilters: InputMaybe<Scalars['Boolean']['input']>;
  order: InputMaybe<Scalars['Int']['input']>;
  page: InputMaybe<Scalars['Int']['input']>;
  preorder: InputMaybe<Scalars['Boolean']['input']>;
  preorders: InputMaybe<Scalars['String']['input']>;
  randomise: InputMaybe<Scalars['Boolean']['input']>;
  sort: InputMaybe<Scalars['String']['input']>;
  stock: InputMaybe<Scalars['String']['input']>;
  styles: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  to: InputMaybe<Scalars['String']['input']>;
  type: InputMaybe<Scalars['String']['input']>;
  types: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  wantlist: InputMaybe<Scalars['Boolean']['input']>;
  years: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
};


export type QueryInventoryFiltersPaginationArgs = {
  filters: InventoryFiltersInput;
  pagination: PaginationInput;
};


export type QueryInventoryItemsArgs = {
  filters: InventoryFiltersInput;
  pagination: PaginationInput;
};


export type QueryItemArgs = {
  id: InputMaybe<Scalars['Float']['input']>;
  itemRef: InputMaybe<Scalars['ID']['input']>;
};


export type QueryItemsArgs = {
  ids: Array<InputMaybe<Scalars['Float']['input']>>;
};


export type QueryLabelsArgs = {
  letter: InputMaybe<Scalars['String']['input']>;
};


export type QueryOrderArgs = {
  id: Scalars['String']['input'];
  status: InputMaybe<Scalars['String']['input']>;
};


export type QueryOrdersArgs = {
  page: InputMaybe<Scalars['Int']['input']>;
};


export type QueryPlaylistArgs = {
  id: Scalars['Int']['input'];
};


export type QuerySearchArgs = {
  stocked: InputMaybe<Scalars['Boolean']['input']>;
  term: Scalars['String']['input'];
};


export type QuerySuggestionsArgs = {
  categories: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  country: InputMaybe<Scalars['String']['input']>;
  genre: InputMaybe<Scalars['String']['input']>;
  genres: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id: InputMaybe<Scalars['Float']['input']>;
  limit: InputMaybe<Scalars['Int']['input']>;
  style: InputMaybe<Scalars['String']['input']>;
  styles: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  type: InputMaybe<Scalars['String']['input']>;
};


export type QueryUserPasswordSessionArgs = {
  token: Scalars['String']['input'];
};

/** Response from a user registration operation. */
export type RegisterResponse = {
  __typename?: 'RegisterResponse';
  /** Optional message about the registration. */
  message: Maybe<Scalars['String']['output']>;
  /** Created session for the new user. */
  session: Maybe<Session>;
  /** Created user account. */
  user: User;
};

/** Format information for a release item. */
export type ReleaseFormat = {
  __typename?: 'ReleaseFormat';
  /** Format descriptions (e.g., "Vinyl", "LP", "Album"). */
  descriptions: Array<Scalars['String']['output']>;
  /** Format name. */
  name: Maybe<Scalars['String']['output']>;
  /** Quantity of items in this format. */
  qty: Maybe<Scalars['String']['output']>;
  /** Full format description text. */
  text: Maybe<Scalars['String']['output']>;
};

/** Results from a search query. */
export type SearchResponse = {
  __typename?: 'SearchResponse';
  /** Items matching the search query. */
  items: Array<Item>;
};

/** Search engine optimization metadata for a page or resource. */
export type SeoEntry = {
  __typename?: 'SeoEntry';
  /** Meta description for search engine results. */
  description: Maybe<Scalars['String']['output']>;
  /** Whether search engines should index this page. */
  index: Maybe<Scalars['Boolean']['output']>;
  /** URL-friendly slug for the page. */
  slug: Maybe<Scalars['String']['output']>;
  /** SEO title for search engine results and browser tabs. */
  title: Maybe<Scalars['String']['output']>;
};

/** Represents an authenticated user session. */
export type Session = {
  __typename?: 'Session';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Session expiration date. */
  expires: Maybe<Scalars['Date']['output']>;
  /** JSON Web Token for authentication. */
  jwt: Scalars['String']['output'];
  /** User associated with this session. */
  user: User;
};

/** Shop-specific description content in multiple formats. */
export type ShopDescriptions = {
  __typename?: 'ShopDescriptions';
  /** HTML-formatted description. */
  html: Maybe<Scalars['String']['output']>;
  /** Short summary description. */
  short: Maybe<Scalars['String']['output']>;
  /** Plain text description. */
  text: Maybe<Scalars['String']['output']>;
};

/** Stock quantity information for a listing. */
export type Stock = {
  __typename?: 'Stock';
  /** Available quantity in stock. Null means stock is not tracked (always available). */
  quantity: Maybe<Scalars['Int']['output']>;
};

/** Track information for a release item. */
export type Track = {
  __typename?: 'Track';
  /** Artists credited on this track. */
  artists: Array<ItemArtist>;
  /** Track duration. */
  duration: Maybe<Scalars['String']['output']>;
  /** Track position on the release. */
  position: Maybe<Scalars['String']['output']>;
  /** Track title. */
  title: Maybe<Scalars['String']['output']>;
  /** Track type (e.g., "heading", "track"). */
  type_: Maybe<Scalars['String']['output']>;
  /** URI to track audio or additional information. */
  uri: Maybe<Scalars['String']['output']>;
};

/** Represents a user account with personal information and preferences. */
export type User = {
  __typename?: 'User';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Saved addresses for the user. */
  addresses: Maybe<Array<Address>>;
  /** Email address for the user account. */
  email: Maybe<Scalars['String']['output']>;
  /** User's first name. */
  firstName: Maybe<Scalars['String']['output']>;
  /**
   * Numeric identifier for the user.
   * @deprecated Field no longer supported
   */
  id: Maybe<Scalars['Float']['output']>;
  /** Whether the user is subscribed to marketing communications. */
  isSubscribed: Maybe<Scalars['Boolean']['output']>;
  /** User's last name. */
  lastName: Maybe<Scalars['String']['output']>;
  /** Full name of the user. */
  name: Maybe<Scalars['String']['output']>;
  /** Organization or company name. */
  organisation: Maybe<Scalars['String']['output']>;
  /** User account preferences and settings. */
  preferences: Maybe<UserPreferences>;
  /** Tax identification number. */
  taxNumber: Maybe<Scalars['String']['output']>;
  /** Telephone number. */
  telephone: Maybe<Scalars['String']['output']>;
};

/** User account preferences and settings. */
export type UserPreferences = {
  __typename?: 'UserPreferences';
  /** Notification preferences. */
  notifications: Maybe<UserPreferencesNotifications>;
  /** Preferred language for the user interface. */
  preferredLanguage: Maybe<Scalars['String']['output']>;
};

/** User notification preferences. */
export type UserPreferencesNotifications = {
  __typename?: 'UserPreferencesNotifications';
  /** Back-in-stock notification settings. */
  backInStock: Maybe<UserPreferencesNotificationsBackInStock>;
};

/** Back-in-stock notification preferences. */
export type UserPreferencesNotificationsBackInStock = {
  __typename?: 'UserPreferencesNotificationsBackInStock';
  /** Whether email notifications are enabled for back-in-stock items. */
  email: Maybe<Scalars['Boolean']['output']>;
};

/** Response from a user verification operation. */
export type UserVerifyResponse = {
  __typename?: 'UserVerifyResponse';
  /** Associated checkout if one exists. */
  checkout: Maybe<Checkout>;
  /** Optional message about the verification. */
  message: Maybe<Scalars['String']['output']>;
  /** Created session for the verified user. */
  session: Maybe<Session>;
};

export type WithdrawalInput = {
  /** Contact email address of the customer. */
  email: Scalars['String']['input'];
  /** Full name of the customer. */
  name: Scalars['String']['input'];
  /** Optional reason for the withdrawal / cancellation. */
  reason?: InputMaybe<Scalars['String']['input']>;
  /** Order number or any other reference provided by the customer. */
  reference: Scalars['String']['input'];
};

/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };