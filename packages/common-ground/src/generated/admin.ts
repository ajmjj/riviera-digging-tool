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
  /** Represents a 64-bit signed integer value. */
  Long: { input: number; output: number; }
  /** Represents a file upload in a multipart request. */
  Upload: { input: never; output: never; }
};

/** Status indicating whether a buyer account was created, matched to an existing account, or not created during invoice sending with account creation. */
export type AccountCreatedStatus =
  /** A new buyer account was created. */
  | 'CREATED'
  /** An existing buyer account was matched and used. */
  | 'MATCHED'
  /** No account was created or matched. */
  | 'NONE';

/** Physical address information for shipping or billing. */
export type Address = {
  __typename?: 'Address';
  /** Internal database identifier. */
  _id: Maybe<Scalars['ID']['output']>;
  /** Primary street address line. */
  addressLine1: Maybe<Scalars['String']['output']>;
  /** Secondary street address line (e.g., apartment, suite number). */
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
  /** Geographic location coordinates for the address. */
  geoLoc: Maybe<AddressGeoLoc>;
  /** Last name of the address recipient. */
  lastName: Maybe<Scalars['String']['output']>;
  /** Postal or ZIP code. */
  postCode: Maybe<Scalars['String']['output']>;
  /** State or province name. */
  state: Maybe<Scalars['String']['output']>;
  /** State or province code abbreviation. */
  stateCode: Maybe<Scalars['String']['output']>;
  /** Street number component of the address. */
  streetNumber: Maybe<Scalars['Int']['output']>;
  /** Type of address (e.g., "billing", "shipping"). */
  type: Maybe<Scalars['String']['output']>;
};

/** Geographic location coordinates using GeoJSON format. */
export type AddressGeoLoc = {
  __typename?: 'AddressGeoLoc';
  /** Array of coordinates in [longitude, latitude] format. */
  coordinates: Array<Scalars['Float']['output']>;
  /** GeoJSON geometry type, typically "Point". */
  type: Scalars['String']['output'];
};

/** Input fields for specifying a physical address. */
export type AddressInput = {
  /** Primary street address line. */
  addressLine1?: InputMaybe<Scalars['String']['input']>;
  /** Secondary street address line, such as apartment or suite number. */
  addressLine2?: InputMaybe<Scalars['String']['input']>;
  /** Two-letter ISO 3166-1 alpha-2 country code. */
  alpha2?: InputMaybe<Scalars['String']['input']>;
  /** City or locality name. */
  city?: InputMaybe<Scalars['String']['input']>;
  /** Full country name. */
  country?: InputMaybe<Scalars['String']['input']>;
  /** Optional description or label for the address. */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Geographic location coordinates for the address. */
  geoLoc?: InputMaybe<GeoLocInput>;
  /** Postal or ZIP code. */
  postCode?: InputMaybe<Scalars['String']['input']>;
  /** State or province name. */
  state?: InputMaybe<Scalars['String']['input']>;
  /** State or province code abbreviation. */
  stateCode?: InputMaybe<Scalars['String']['input']>;
  /** Street number component of the address. */
  streetNumber?: InputMaybe<Scalars['Int']['input']>;
  /** Type of address, such as billing or shipping. */
  type?: InputMaybe<Scalars['String']['input']>;
};

/** Represents an admin user with access to the backoffice. */
export type Admin = {
  __typename?: 'Admin';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Date when the admin was added to the system. */
  addedAt: Maybe<Scalars['Date']['output']>;
  /** Admin's email address. */
  email: Scalars['String']['output'];
  /** Admin's first name. */
  firstName: Maybe<Scalars['String']['output']>;
  /**
   * Whether the admin has Intercom integration. This field is deprecated.
   * @deprecated Field no longer supported
   */
  hasIntercom: Maybe<Scalars['Boolean']['output']>;
  /** Whether the admin has a passcode configured. */
  hasPasscode: Maybe<Scalars['Boolean']['output']>;
  /** Date of the admin's last login. */
  lastLogin: Maybe<Scalars['Date']['output']>;
  /** Admin's last name. */
  lastName: Maybe<Scalars['String']['output']>;
  /** Multi-factor authentication configuration. */
  mfa: Maybe<AdminMfa>;
  /** Admin's full name. */
  name: Maybe<Scalars['String']['output']>;
  /** Password reset token. */
  passwordToken: Maybe<Scalars['String']['output']>;
  /** User type (always "admin" for admin users). */
  type: Scalars['String']['output'];
  /** Email verification status and information. */
  verification: Maybe<UserVerification>;
};

/** Multi-factor authentication configuration for admin users. */
export type AdminMfa = {
  __typename?: 'AdminMFA';
  /** Whether MFA is currently active. */
  active: Maybe<Scalars['Boolean']['output']>;
  /** Date when MFA was last modified. */
  lastModified: Maybe<Scalars['Date']['output']>;
  /** MFA secret key. */
  secret: Maybe<Scalars['String']['output']>;
};

/** Folder an article belongs to, denormalized from the config folder definition. */
export type ArticleFolderReference = {
  __typename?: 'ArticleFolderReference';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Reference to the config folder. */
  ref: Scalars['ID']['output'];
  /** URL-safe slug used as the path prefix (e.g. "shows"). */
  slug: Scalars['String']['output'];
  /** Human-readable display name (e.g. "My Shows"). */
  title: Scalars['String']['output'];
};

/** Aggregated statistics for an article over a given date range. */
export type ArticleStatistics = {
  __typename?: 'ArticleStatistics';
  /** Bucket granularity chosen for the series based on the date range. */
  granularity: StatisticsGranularity;
  /** Total page views in the period. */
  pageViews: Scalars['Int']['output'];
  /** Time series of page views. */
  series: Array<StatisticsDataPoint>;
};

/** Billing information including payment methods, status, and invoice details. */
export type Billing = {
  __typename?: 'Billing';
  /** Billing address for the order. */
  address: Maybe<Address>;
  /** Whether billing has been fulfilled (paid or refunded). */
  fulfilled: Maybe<Scalars['Boolean']['output']>;
  /** Invoice information for this billing. */
  invoice: BillingInvoice;
  /** Date when payment was received. */
  paymentDate: Maybe<Scalars['Date']['output']>;
  /** Payment methods used for this order. */
  paymentMethods: Array<PaymentMethod>;
  /** Date when refund was processed. */
  refundDate: Maybe<Scalars['Date']['output']>;
  /** Refund methods processed for this order. */
  refunds: Array<PaymentMethod>;
  /** Current billing status. Valid values include "Pending", "Paid", "Partially Paid", "Refunded", or "Partially Refunded". */
  status: Scalars['String']['output'];
  /** Voucher applied to this billing (if any). */
  voucher: Maybe<VoucherEmbedded>;
};

/** Credit note applied to billing, reducing the total amount due. */
export type BillingCreditNote = {
  __typename?: 'BillingCreditNote';
  /** Credit amount applied to the billing total. */
  amount: Maybe<Scalars['Float']['output']>;
  /** Title or description of the credit note. */
  title: Maybe<Scalars['String']['output']>;
};

/** Invoice information for billing, including PDF and email details. */
export type BillingInvoice = {
  __typename?: 'BillingInvoice';
  /** Date when the invoice was generated. */
  date: Maybe<Scalars['Date']['output']>;
  /** Email recipients who received the invoice. */
  emails: Maybe<Array<EmailRecipient>>;
  /** Invoice identifier or number. */
  id: Maybe<Scalars['String']['output']>;
  /** URL to the PDF document for the invoice. */
  pdf: Maybe<Scalars['String']['output']>;
};

/** Industry identifier for a book item (e.g., ISBN, ASIN). */
export type BookIdentifier = {
  __typename?: 'BookIdentifier';
  /** The identifier value. */
  identifier: Maybe<Scalars['String']['output']>;
  /** Type of identifier (e.g., "ISBN_13", "ISBN_10", "ASIN"). */
  type: Maybe<Scalars['String']['output']>;
};

/** Represents a book item with book-specific data. */
export type BookItem = ItemInterface & {
  __typename?: 'BookItem';
  _id: Scalars['ID']['output'];
  bitly: Maybe<Scalars['String']['output']>;
  created: Maybe<Scalars['Date']['output']>;
  creatorsId: Maybe<Scalars['String']['output']>;
  /** Book-specific data and metadata. */
  data: BookItemData;
  descriptions: ItemDescriptions;
  /** @deprecated Field no longer supported */
  handle: Maybe<Scalars['String']['output']>;
  id: Scalars['Float']['output'];
  incId: Maybe<Scalars['Float']['output']>;
  isForbiddenForSale: Maybe<Scalars['Boolean']['output']>;
  listings: Array<Listing>;
  /** @deprecated Field no longer supported */
  logs: Maybe<Array<Maybe<LogEntry>>>;
  modified: Maybe<Scalars['Date']['output']>;
  oldId: Maybe<Scalars['Float']['output']>;
  path: Scalars['String']['output'];
  seo: Maybe<SeoEntry>;
  type: ItemType;
  uniqueId: Maybe<Scalars['String']['output']>;
  uri: Maybe<Scalars['String']['output']>;
  wants: Maybe<Scalars['Int']['output']>;
};

/** Detailed data and metadata specific to book items. */
export type BookItemData = {
  __typename?: 'BookItemData';
  /** Authors of the book. */
  authors: Maybe<Array<Scalars['String']['output']>>;
  /** Categories the book belongs to. */
  categories: Maybe<Array<Scalars['String']['output']>>;
  /** Format description of the book (e.g., "Hardcover", "Paperback"). */
  format: Maybe<Scalars['String']['output']>;
  /** Images associated with the book. */
  images: Array<ReleaseImage>;
  /**
   * Industry identifiers for the book (e.g., ISBN, ASIN).
   * @deprecated use identifiers instead
   */
  industryIdentifiers: Maybe<Array<Maybe<BookIdentifier>>>;
  /** Language of the book (ISO 639-1 code). */
  language: Maybe<Scalars['String']['output']>;
  /** Maturity rating for the book. */
  maturityRating: Maybe<Scalars['String']['output']>;
  /** Number of pages in the book. */
  pageCount: Maybe<Scalars['Int']['output']>;
  /** Publication date of the book. */
  publishedDate: Maybe<Scalars['Date']['output']>;
  /** Publisher of the book. */
  publisher: Maybe<Scalars['String']['output']>;
  /** Subtitle of the book. */
  subtitle: Maybe<Scalars['String']['output']>;
  /** Title of the book. */
  title: Maybe<Scalars['String']['output']>;
};

/** Represents a buyer (customer) user account. */
export type Buyer = {
  __typename?: 'Buyer';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Whether the buyer has created an account (vs. guest checkout). */
  accountCreated: Maybe<Scalars['Boolean']['output']>;
  /** Whether the buyer account is active. */
  active: Maybe<Scalars['Boolean']['output']>;
  /** Saved addresses for the buyer. */
  addresses: Array<Address>;
  /** Buyer's birthdate. */
  birthdate: Maybe<Scalars['Date']['output']>;
  /** Number of checkouts placed by the buyer. */
  checkoutCount: Maybe<Scalars['Int']['output']>;
  /** Date when the buyer account was created. */
  created: Scalars['Date']['output'];
  /** Number of credit notes issued to the buyer. */
  creditNotesCount: Maybe<Scalars['Int']['output']>;
  /** Buyer's email address. */
  email: Maybe<Scalars['String']['output']>;
  /** Buyer's first name. */
  firstName: Maybe<Scalars['String']['output']>;
  /** Date of the buyer's last login. */
  lastLogin: Maybe<Scalars['Date']['output']>;
  /** Buyer's last name. */
  lastName: Maybe<Scalars['String']['output']>;
  /** Customer lists the buyer is a member of. */
  lists: Array<BuyerList>;
  /** Buyer's full name. */
  name: Maybe<Scalars['String']['output']>;
  /** Notes or comments about the buyer. */
  notes: Maybe<Scalars['String']['output']>;
  /** Total number of orders placed by the buyer. */
  orderCount: Maybe<Scalars['Int']['output']>;
  /** Total value of all orders placed by the buyer. */
  orderTotal: Maybe<Scalars['Float']['output']>;
  /** Organization or company name. */
  organisation: Maybe<Scalars['String']['output']>;
  /** URL path to the buyer's profile page. */
  path: Maybe<Scalars['String']['output']>;
  /** Tax identification number. */
  taxNumber: Maybe<Scalars['String']['output']>;
  /** Buyer's telephone number. */
  telephone: Maybe<Scalars['String']['output']>;
  /** User type (always "buyer" for buyer users). This field is deprecated. */
  type: Maybe<Scalars['String']['output']>;
  /** Date when the buyer account was last updated. */
  updated: Maybe<Scalars['Date']['output']>;
  /** Email verification status and information. */
  verification: Maybe<UserVerification>;
  /** Number of vouchers associated with the buyer. */
  vouchersCount: Maybe<Scalars['Int']['output']>;
  /** Number of items in the buyer's wantlist. */
  wantsCount: Maybe<Scalars['Int']['output']>;
};

/** Response type for buyer creation operations, containing the created buyer and a message describing the result. */
export type BuyerCreateResponse = {
  __typename?: 'BuyerCreateResponse';
  /** Message describing the result of the buyer creation operation. */
  message: Scalars['String']['output'];
  /** The newly created buyer. */
  user: Buyer;
};

/** Buyer's membership in a customer list. */
export type BuyerList = {
  __typename?: 'BuyerList';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Date when the buyer was added to the list. */
  added: Maybe<Scalars['Date']['output']>;
  /** Date when the list membership was last modified. */
  lastModified: Maybe<Scalars['Date']['output']>;
  /** Opt-out information if the buyer has opted out. */
  optout: Maybe<BuyerListOptout>;
  /** Reference to the list. */
  ref: Scalars['ID']['output'];
};

/** Opt-out information for a buyer list membership. */
export type BuyerListOptout = {
  __typename?: 'BuyerListOptout';
  /** Date when the opt-out occurred. */
  date: Maybe<Scalars['Date']['output']>;
  /** Reason for opting out. */
  reason: Maybe<Scalars['String']['output']>;
  /** Whether the user has opted out. */
  status: Maybe<Scalars['Boolean']['output']>;
};

/** Buyer information shared between checkout and order contexts. */
export type CheckoutOrOrderBuyer = {
  __typename?: 'CheckoutOrOrderBuyer';
  /** Internal database identifier for the buyer. */
  _id: Maybe<Scalars['ID']['output']>;
  /** Addresses associated with the buyer. */
  addresses: Maybe<Array<Address>>;
  /** Email address of the buyer. */
  email: Maybe<Scalars['String']['output']>;
  /** First name of the buyer. */
  firstName: Maybe<Scalars['String']['output']>;
  /** Last name of the buyer. */
  lastName: Maybe<Scalars['String']['output']>;
  /** Full name of the buyer (first name and last name combined). */
  name: Maybe<Scalars['String']['output']>;
  /** Organization or company name of the buyer. */
  organisation: Maybe<Scalars['String']['output']>;
  /** URL path to the buyer's profile page. */
  path: Maybe<Scalars['String']['output']>;
  /** Tax identification number of the buyer. */
  taxNumber: Maybe<Scalars['String']['output']>;
  /** Telephone number of the buyer. */
  telephone: Maybe<Scalars['String']['output']>;
};

export type CheckoutOrigins =
  | 'Online'
  | 'Shop';

export type CheckoutStatus =
  | 'complete'
  | 'open';

/** Represents a curated collection of items with filtering and display settings. */
export type Collection = {
  __typename?: 'Collection';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Banner image for the collection. */
  banner: Maybe<CollectionBanner>;
  /** Date when the collection was created. */
  created: Maybe<Scalars['Date']['output']>;
  /** User who created the collection. */
  createdBy: Maybe<UserReference>;
  /** Description of the collection. */
  description: Maybe<CollectionDescription>;
  /** URL-friendly handle for the collection. */
  handle: Scalars['String']['output'];
  /** Numeric identifier for the collection. */
  id: Scalars['Int']['output'];
  /**
   * URL path to the collection page. This field is deprecated.
   * @deprecated Field no longer supported
   */
  path: Maybe<Scalars['String']['output']>;
  /** Segments defining filter criteria for the collection. */
  segments: Array<CollectionSegment>;
  /** SEO metadata for the collection. */
  seo: Maybe<SeoEntry>;
  /** Default sort configuration for the collection. */
  sort: Maybe<CollectionSort>;
  /** Title of the collection. */
  title: Scalars['String']['output'];
  /** View type for displaying the collection (e.g., "tile", "list", "full"). */
  viewType: Maybe<Scalars['String']['output']>;
};

/** Banner image for a collection. */
export type CollectionBanner = {
  __typename?: 'CollectionBanner';
  /** Format identifier for the banner image. */
  format: Maybe<Scalars['String']['output']>;
  /** Media file for the banner. */
  media: Maybe<Media>;
};

/** Contains paginated items within a specific collection segment, along with pagination details. */
export type CollectionData = {
  __typename?: 'CollectionData';
  /** List of items included in the collection segment. */
  items: Array<Item>;
  /** Pagination information for the items in the collection segment. */
  pagination: Maybe<Pagination>;
};

/** Description content for a collection. */
export type CollectionDescription = {
  __typename?: 'CollectionDescription';
  /** Description text content. */
  content: Maybe<Scalars['String']['output']>;
};

/** Filter criteria within a collection segment. */
export type CollectionFilter = {
  __typename?: 'CollectionFilter';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Filter identifier. */
  id: Scalars['String']['output'];
  /** Display title for the filter. */
  title: Maybe<Scalars['String']['output']>;
  /** Filter value as JSON data. */
  value: Maybe<Scalars['JSON']['output']>;
  /** Filter value with human-readable labels as JSON data. */
  valueWithLabels: Maybe<Scalars['JSON']['output']>;
};

/** Paginated items returned for a collection, used by the backoffice article block editor. */
export type CollectionItems = {
  __typename?: 'CollectionItems';
  /** List of items in the collection for the requested page. */
  items: Array<Item>;
  /** Pagination details for the result set. */
  pagination: Pagination;
};

/** A segment within a collection containing multiple filters. */
export type CollectionSegment = {
  __typename?: 'CollectionSegment';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Filters applied within this segment. */
  filters: Array<CollectionFilter>;
  /** Title of the collection segment. */
  title: Maybe<Scalars['String']['output']>;
};

/** Sort configuration for a collection. */
export type CollectionSort = {
  __typename?: 'CollectionSort';
  /** Field name to sort by (e.g., "posted", "price", "available"). */
  key: Maybe<Scalars['String']['output']>;
  /** Sort order (1 for ascending, -1 for descending). */
  order: Maybe<Scalars['Int']['output']>;
};

/** Specifies sorting options for collections, including the field to sort by and the sort order. */
export type CollectionSortInput = {
  /** Field name to sort collections by (e.g., title, date). */
  key?: InputMaybe<Scalars['String']['input']>;
  /** Sort order: 1 for ascending, -1 for descending. */
  order?: InputMaybe<Scalars['Int']['input']>;
};

/** Provides a paginated connection to multiple collections, including the list of collections and pagination details. */
export type CollectionsConnection = {
  __typename?: 'CollectionsConnection';
  /** List of collections returned in the current page. */
  collections: Array<Collection>;
  /** Pagination information for navigating through the collections list. */
  pagination: Pagination;
};

/** Main configuration object containing all shop settings, integrations, and preferences. */
export type Config = {
  __typename?: 'Config';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** List of admin users with access to this configuration. */
  admins: Array<ConfigAdmin>;
  /** Whether the configuration is archived. */
  archived: Maybe<Scalars['Boolean']['output']>;
  /** Date when the configuration was archived. */
  archivedDate: Maybe<Scalars['Date']['output']>;
  /** Bandcamp integration configuration. */
  bandcamp: Maybe<ConfigBandcamp>;
  /** Carrier aggregator configuration for live shipping rates. */
  carriers: Maybe<ConfigCarriers>;
  /** Communication settings. */
  communication: Maybe<ConfigCommunication>;
  /** Community features configuration. */
  community: Maybe<ConfigCommunity>;
  /** Date when the configuration was created. */
  created: Scalars['Date']['output'];
  /** Currency code (e.g., "EUR", "USD"). */
  currency: Scalars['String']['output'];
  /** Currency symbol (e.g., "€", "$"). */
  currencySymbol: Scalars['String']['output'];
  /** Currency symbol position ("before" or "after"). */
  currencySymbolPosition: Scalars['String']['output'];
  /** Discogs integration configuration. */
  discogs: ConfigDiscogs;
  /** Primary domain name. */
  domain: Maybe<Scalars['String']['output']>;
  /** eBay integration configuration. */
  ebay: Maybe<ConfigEbay>;
  /** E-shop configuration. */
  eshop: ConfigEshop;
  /** Google services configuration. */
  google: Maybe<ConfigGoogle>;
  /** Numeric identifier for the configuration. */
  id: Scalars['Int']['output'];
  /** Inventory automation settings. */
  inventory: Maybe<ConfigInventory>;
  /** Invoicing configuration. */
  invoicing: Maybe<ConfigInvoicing>;
  /** Meta (Facebook) integration configuration. */
  meta: Maybe<ConfigMeta>;
  /** Metadata configuration for catalog and inventory. */
  metadata: Maybe<ConfigMetadata>;
  /** Configuration modules as JSON data. */
  modules: Scalars['JSON']['output'];
  /** Notes or comments about the configuration. */
  notes: Maybe<Scalars['String']['output']>;
  /** Recordfy integration configuration. */
  recordfy: Maybe<ConfigRecordfy>;
  /** Shop name. */
  shopName: Scalars['String']['output'];
  /** List of domain configurations. */
  sites: Array<ConfigDomain>;
  /** List of social media links. */
  socials: Array<ConfigSocial>;
  /** Stack configuration. */
  stack: Maybe<ConfigStack>;
  /** Statistics configuration. */
  statistics: ConfigStatistics;
  /** Shop status configuration. */
  status: ConfigStatus;
  /** Storage configuration. */
  storage: Maybe<ConfigStorage>;
  /** Stripe customer configuration. */
  stripe: Maybe<ConfigStripe>;
  /** List of tags for categorization. */
  tags: Array<Scalars['String']['output']>;
  /** Tax configuration. */
  taxes: ConfigTaxes;
  /** Shop URI. */
  uri: Scalars['String']['output'];
};

/** Admin user configuration entry. */
export type ConfigAdmin = {
  __typename?: 'ConfigAdmin';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Information about when the admin was added. */
  added: Maybe<ConfigAdminAdded>;
  /** Admin user object. */
  admin: Maybe<Admin>;
  /** Admin role (e.g., "admin", "superadmin"). */
  role: Maybe<Scalars['String']['output']>;
};

/** Information about when an admin was added to the config. */
export type ConfigAdminAdded = {
  __typename?: 'ConfigAdminAdded';
  /** User who added the admin. */
  by: Maybe<UserReference>;
  /** Date when the admin was added. */
  date: Maybe<Scalars['Date']['output']>;
};

/** Analytics entry with count information. */
export type ConfigAnalyticsEntry = {
  __typename?: 'ConfigAnalyticsEntry';
  /** Count value. */
  count: Scalars['Int']['output'];
};

/** Invoice analytics entry with total amount. */
export type ConfigAnalyticsInvoiceEntry = {
  __typename?: 'ConfigAnalyticsInvoiceEntry';
  /** Total invoice amount. */
  total: Scalars['Float']['output'];
};

/** A folder used to group and organize articles under a shared URL prefix. */
export type ConfigArticleFolder = {
  __typename?: 'ConfigArticleFolder';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Optional article used as the root page for this folder (e.g. an intro page at site.com/shows). */
  articleRef: Maybe<Scalars['ID']['output']>;
  /** Count of articles in the folder. */
  count: Scalars['Int']['output'];
  /** Optional media item for building a dynamic header or mosaic on the folder root page. */
  mediaRef: Maybe<Scalars['ID']['output']>;
  /** SEO settings for the folder's root page. */
  seo: Maybe<SeoEntry>;
  /** URL-safe slug used as the path prefix (e.g. "shows"). */
  slug: Scalars['String']['output'];
  /** Human-readable display name (e.g. "My Shows"). */
  title: Scalars['String']['output'];
};

/** Bandcamp integration configuration. */
export type ConfigBandcamp = {
  __typename?: 'ConfigBandcamp';
  /** Bandcamp OAuth access token. */
  accessToken: Maybe<Scalars['String']['output']>;
  /** List of configured bands. */
  bands: Array<ConfigBandcampBand>;
  /** Bandcamp client identifier. */
  clientId: Maybe<Scalars['String']['output']>;
  /** Bandcamp client secret. */
  clientSecret: Maybe<Scalars['String']['output']>;
  /** Bandcamp OAuth refresh token. */
  refreshToken: Maybe<Scalars['String']['output']>;
};

/** Bandcamp band configuration. */
export type ConfigBandcampBand = {
  __typename?: 'ConfigBandcampBand';
  /** Whether the band is active. */
  active: Scalars['Boolean']['output'];
  /** Bandcamp band identifier. */
  id: Scalars['Float']['output'];
  /** Band name. */
  name: Scalars['String']['output'];
};

/** Carrier aggregator configuration for live shipping rates (Sendcloud/Shippo). */
export type ConfigCarriers = {
  __typename?: 'ConfigCarriers';
  /** Enabled aggregator. Valid values are "sendcloud" or "shippo". A single aggregator can be enabled per account. */
  aggregator: Maybe<Scalars['String']['output']>;
  /** Carrier aggregator credentials. */
  credentials: Maybe<ConfigCarriersCredentials>;
  /** Whether the carrier aggregator integration is enabled. */
  enabled: Scalars['Boolean']['output'];
  /** Percentage added to quoted prices for handling/packaging. */
  extraRate: Scalars['Float']['output'];
  /** Provider-side sender address identifier to ship from. Sender addresses are managed on the provider and fetched live. */
  senderAddressId: Maybe<Scalars['String']['output']>;
};

/** Carrier aggregator credentials. */
export type ConfigCarriersCredentials = {
  __typename?: 'ConfigCarriersCredentials';
  /** API access token (Sendcloud public key / Shippo API token). */
  accessToken: Maybe<Scalars['String']['output']>;
  /** API secret key (Sendcloud only). */
  secretKey: Maybe<Scalars['String']['output']>;
};

/** Communication settings configuration. */
export type ConfigCommunication = {
  __typename?: 'ConfigCommunication';
  /** Email configuration. */
  emails: Maybe<ConfigCommunicationEmails>;
  /** Default language for communications. */
  language: Maybe<Scalars['String']['output']>;
};

/** Email configuration for communication settings. */
export type ConfigCommunicationEmails = {
  __typename?: 'ConfigCommunicationEmails';
  /** List of email endpoint addresses. */
  endpoints: Maybe<Array<Scalars['String']['output']>>;
  /** Email address to send from. */
  from: Maybe<Scalars['String']['output']>;
};

/** Community features configuration. */
export type ConfigCommunity = {
  __typename?: 'ConfigCommunity';
  /** Community feed configuration. */
  feed: Maybe<ConfigCommunityFeed>;
};

/** Community feed configuration. */
export type ConfigCommunityFeed = {
  __typename?: 'ConfigCommunityFeed';
  /** Whether the community feed is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
};

/** Discogs integration configuration. */
export type ConfigDiscogs = {
  __typename?: 'ConfigDiscogs';
  /** OAuth access data after authorization. */
  accessData: Maybe<ConfigDiscogsOauthData>;
  /** Whether Discogs integration is enabled. */
  enabled: Scalars['Boolean']['output'];
  /** Whether to exclude taxes from Discogs prices. */
  excludeTaxesFromPrice: Scalars['Boolean']['output'];
  /** Whether to generate discrepancy reports. */
  generateDiscrepancyReports: Scalars['Boolean']['output'];
  /** Extra rate to add to Discogs listings. */
  listingExtraRate: Scalars['Float']['output'];
  /** OAuth request data for authorization. */
  requestData: Maybe<ConfigDiscogsOauthData>;
  /** Whether to sync inventory with Discogs. */
  syncInventory: Scalars['Boolean']['output'];
  /** Discogs API token. */
  token: Maybe<Scalars['String']['output']>;
  /** Discogs username. */
  username: Maybe<Scalars['String']['output']>;
};

/** Discogs OAuth data configuration. */
export type ConfigDiscogsOauthData = {
  __typename?: 'ConfigDiscogsOauthData';
  /** OAuth authorization URL. */
  authorizeUrl: Maybe<Scalars['String']['output']>;
  /** OAuth consumer key. */
  consumerKey: Maybe<Scalars['String']['output']>;
  /** OAuth consumer secret. */
  consumerSecret: Maybe<Scalars['String']['output']>;
  /** OAuth access level. */
  level: Maybe<Scalars['Int']['output']>;
  /** OAuth method. */
  method: Maybe<Scalars['String']['output']>;
  /** OAuth token. */
  token: Maybe<Scalars['String']['output']>;
  /** OAuth token secret. */
  tokenSecret: Maybe<Scalars['String']['output']>;
};

/** Domain configuration for a shop site. */
export type ConfigDomain = {
  __typename?: 'ConfigDomain';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** SSL certificate configuration. */
  certificate: Maybe<ConfigDomainCertificate>;
  /** Date when the domain was created. */
  created: Maybe<Scalars['Date']['output']>;
  /** Domain name. */
  domain: Scalars['String']['output'];
  /** Whether this is the default domain. */
  isDefault: Maybe<Scalars['Boolean']['output']>;
  /** Whether this is the primary domain. */
  isPrimary: Maybe<Scalars['Boolean']['output']>;
  /** Domain redirect configuration. */
  redirect: Maybe<ConfigDomainRedirect>;
};

/** SSL certificate configuration for a domain. */
export type ConfigDomainCertificate = {
  __typename?: 'ConfigDomainCertificate';
  /**
   * Whether the certificate has been added to the load balancer. This field is deprecated.
   * @deprecated Field no longer supported
   */
  addedToLoadBalancer: Maybe<Scalars['Boolean']['output']>;
  /**
   * AWS ARN for the certificate. This field is deprecated.
   * @deprecated Field no longer supported
   */
  arn: Maybe<Scalars['String']['output']>;
  /**
   * Load balancer identifier. This field is deprecated.
   * @deprecated Field no longer supported
   */
  loadBalancer: Maybe<Scalars['String']['output']>;
  /**
   * Certificate provider. This field is deprecated.
   * @deprecated Field no longer supported
   */
  provider: Maybe<Scalars['String']['output']>;
  /** DNS records required for certificate validation. */
  records: Maybe<Array<ConfigDomainCertificateRecord>>;
  /**
   * AWS region for the certificate. This field is deprecated.
   * @deprecated Field no longer supported
   */
  region: Maybe<Scalars['String']['output']>;
  /** Current status of the certificate. */
  status: Maybe<Scalars['String']['output']>;
  /** Whether the certificate has been validated. */
  validated: Maybe<Scalars['Boolean']['output']>;
};

/** DNS record for domain certificate configuration. */
export type ConfigDomainCertificateRecord = {
  __typename?: 'ConfigDomainCertificateRecord';
  /** DNS record name. */
  name: Scalars['String']['output'];
  /** DNS record type (e.g., "A", "CNAME", "TXT"). */
  type: Maybe<Scalars['String']['output']>;
  /** DNS record value. */
  value: Scalars['String']['output'];
};

/** Domain redirect configuration. */
export type ConfigDomainRedirect = {
  __typename?: 'ConfigDomainRedirect';
  /**
   * Host to redirect from. This field is deprecated.
   * @deprecated Field no longer supported
   */
  host: Maybe<Scalars['String']['output']>;
  /** DNS records required for redirect configuration. */
  records: Maybe<Array<ConfigDomainCertificateRecord>>;
  /**
   * Target URL to redirect to. This field is deprecated.
   * @deprecated Field no longer supported
   */
  target: Maybe<Scalars['String']['output']>;
  /** Whether the redirect has been validated. */
  validated: Maybe<Scalars['Boolean']['output']>;
};

/** eBay integration configuration. */
export type ConfigEbay = {
  __typename?: 'ConfigEbay';
  /** Bulk listing tool configuration. */
  bulkListingTool: Maybe<ConfigEbayBulkListingTool>;
};

/** eBay bulk listing tool configuration. */
export type ConfigEbayBulkListingTool = {
  __typename?: 'ConfigEbayBulkListingTool';
  /** Whether the bulk listing tool is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
};

/** E-shop configuration including checkout, preferences, SEO, menus, and theme. */
export type ConfigEshop = {
  __typename?: 'ConfigEshop';
  /** Checkout configuration. */
  checkout: ConfigEshopCheckout;
  /** Head tags configuration. */
  head: ConfigEshopHead;
  /** E-shop preferences. */
  preferences: ConfigEshopPreferences;
  /** SEO configuration. */
  seo: ConfigEshopSeo;
  /** E-shop URI. */
  uri: Maybe<Scalars['String']['output']>;
};

/** Checkout configuration for the e-shop. */
export type ConfigEshopCheckout = {
  __typename?: 'ConfigEshopCheckout';
  /** List of addresses to ship from. */
  fromAddresses: Maybe<Array<Address>>;
  /** Shipping package configuration. */
  packages: Maybe<ConfigEshopCheckoutShippingPackages>;
  /** Payment methods configuration. */
  paymentMethods: Maybe<ConfigEshopCheckoutPaymentMethods>;
  /** Shipping policies configuration. */
  shippingPolicies: Array<ConfigEshopCheckoutShippingPolicy>;
  /** Checkout version number. */
  version: Maybe<Scalars['String']['output']>;
};

/** Cash in advance payment method configuration. */
export type ConfigEshopCheckoutCashInAdvance = {
  __typename?: 'ConfigEshopCheckoutCashInAdvance';
  /** Notes or instructions for cash in advance payments. */
  notes: Maybe<Scalars['String']['output']>;
  /** Whether cash in advance is enabled. */
  status: Maybe<Scalars['Boolean']['output']>;
};

/** Mercado Pago payment method configuration. */
export type ConfigEshopCheckoutMercado = {
  __typename?: 'ConfigEshopCheckoutMercado';
  /** Mercado Pago access token. */
  accessToken: Maybe<Scalars['String']['output']>;
  /** Mercado Pago client identifier. */
  clientId: Maybe<Scalars['String']['output']>;
  /** Mercado Pago client secret. */
  clientSecret: Maybe<Scalars['String']['output']>;
  /** Whether Mercado Pago is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
  /** Mercado Pago public key. */
  publicKey: Maybe<Scalars['String']['output']>;
};

/** Payment methods configuration for checkout. */
export type ConfigEshopCheckoutPaymentMethods = {
  __typename?: 'ConfigEshopCheckoutPaymentMethods';
  /** Cash in advance payment configuration. */
  cashInAdvance: Maybe<ConfigEshopCheckoutCashInAdvance>;
  /** Flitt payment processor configuration. */
  flitt: Maybe<ConfigEshopCheckoutTwoStepPaymentProcessorFlitt>;
  /** Iyzipay payment processor configuration. */
  iyzipay: Maybe<ConfigEshopCheckoutTwoStepPaymentProcessor>;
  /** Mercado Pago payment configuration. */
  mercado: Maybe<ConfigEshopCheckoutMercado>;
  /** PayPal payment configuration. */
  paypal: Maybe<ConfigEshopCheckoutPaypal>;
  /** Stripe payment configuration. */
  stripe: Maybe<ConfigEshopCheckoutStripe>;
};

/** PayPal payment method configuration. */
export type ConfigEshopCheckoutPaypal = {
  __typename?: 'ConfigEshopCheckoutPaypal';
  /** PayPal client identifier. */
  clientId: Maybe<Scalars['String']['output']>;
  /** PayPal client secret. */
  clientSecret: Maybe<Scalars['String']['output']>;
  /** Whether PayPal is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
  /** PayPal.me URL for payments. */
  meUrl: Maybe<Scalars['String']['output']>;
};

/** Shipping package configuration for checkout. */
export type ConfigEshopCheckoutShippingPackages = {
  __typename?: 'ConfigEshopCheckoutShippingPackages';
  /** Dimension unit (e.g., "cm", "in"). */
  dimensionUnit: Maybe<Scalars['String']['output']>;
  /** Package height. */
  height: Maybe<Scalars['Float']['output']>;
  /** Package length. */
  length: Maybe<Scalars['Float']['output']>;
  /** Mass unit (e.g., "kg", "lb"). */
  massUnit: Maybe<Scalars['String']['output']>;
  /** Package name. */
  name: Maybe<Scalars['String']['output']>;
  /** Package weight. */
  weight: Maybe<Scalars['Float']['output']>;
  /** Package width. */
  width: Maybe<Scalars['Float']['output']>;
};

/** Shipping policy configuration defining shipping costs for specific countries. */
export type ConfigEshopCheckoutShippingPolicy = {
  __typename?: 'ConfigEshopCheckoutShippingPolicy';
  /** Internal identifier for the policy. */
  _id: Scalars['String']['output'];
  /** Whether the policy is currently active. */
  active: Scalars['Boolean']['output'];
  /** List of country codes this policy applies to. */
  countries: Array<Scalars['String']['output']>;
  /** Date when the policy was created. */
  createdAt: Scalars['Date']['output'];
  /** Threshold value above which shipping is free. */
  freeShippingThreshold: Maybe<Scalars['Float']['output']>;
  /** Shipping methods available in this policy. */
  methods: Array<ConfigEshopCheckoutShippingPolicyMethods>;
  /**
   * When true and a carrier aggregator is enabled, this policy's manual methods are used
   * instead of live carrier rates for the countries it covers.
   */
  overrideCarrierRates: Maybe<Scalars['Boolean']['output']>;
  /** Display title for the shipping policy. */
  title: Scalars['String']['output'];
  /** Date when the policy was last updated. */
  updatedAt: Scalars['Date']['output'];
};

/** Shipping method within a shipping policy. */
export type ConfigEshopCheckoutShippingPolicyMethods = {
  __typename?: 'ConfigEshopCheckoutShippingPolicyMethods';
  /** Internal identifier for the method. */
  _id: Scalars['String']['output'];
  /** Cost ranges for this shipping method. */
  ranges: Array<ConfigEshopCheckoutShippingPolicyRanges>;
  /** Display title for the shipping method. */
  title: Scalars['String']['output'];
  /** Type of calculation for this shipping method. */
  type: ShippingPolicyTypes;
};

/** Shipping cost range for a shipping policy method. */
export type ConfigEshopCheckoutShippingPolicyRanges = {
  __typename?: 'ConfigEshopCheckoutShippingPolicyRanges';
  /** Internal identifier for the range. */
  _id: Scalars['String']['output'];
  /** Starting value for this range. */
  from: Scalars['Float']['output'];
  /** Ending value for this range (null for unlimited). */
  to: Maybe<Scalars['Float']['output']>;
  /** Shipping cost for this range. */
  value: Scalars['Float']['output'];
};

/** Stripe payment method configuration. */
export type ConfigEshopCheckoutStripe = {
  __typename?: 'ConfigEshopCheckoutStripe';
  /** Stripe account identifier. */
  accountId: Maybe<Scalars['String']['output']>;
  /** Whether Stripe is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
  /** List of Stripe locations for in-person payments. */
  locations: Maybe<Array<ConfigEshopCheckoutStripeLocation>>;
  /** Stripe publishable key. */
  publishableKey: Maybe<Scalars['String']['output']>;
  /** Stripe secret key. */
  secretKey: Maybe<Scalars['String']['output']>;
};

/** Stripe location configuration for in-person payments. */
export type ConfigEshopCheckoutStripeLocation = {
  __typename?: 'ConfigEshopCheckoutStripeLocation';
  /** Internal identifier. */
  _id: Scalars['ID']['output'];
  /** Physical address of the location. */
  address: Address;
  /** Stripe location identifier. */
  id: Maybe<Scalars['String']['output']>;
  /** Location name. */
  name: Scalars['String']['output'];
};

/** Two-step payment processor configuration (e.g., Iyzipay). */
export type ConfigEshopCheckoutTwoStepPaymentProcessor = {
  __typename?: 'ConfigEshopCheckoutTwoStepPaymentProcessor';
  /** API key for the payment processor. */
  apiKey: Maybe<Scalars['String']['output']>;
  /** Whether the payment processor is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
  /** Secret key for the payment processor. */
  secretKey: Maybe<Scalars['String']['output']>;
};

/** Flitt payment processor configuration. */
export type ConfigEshopCheckoutTwoStepPaymentProcessorFlitt = {
  __typename?: 'ConfigEshopCheckoutTwoStepPaymentProcessorFlitt';
  /** Whether Flitt is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
  /** Merchant identifier for Flitt. */
  merchantId: Maybe<Scalars['String']['output']>;
  /** Secret key for Flitt. */
  secretKey: Maybe<Scalars['String']['output']>;
};

/** Head tags configuration for the e-shop. */
export type ConfigEshopHead = {
  __typename?: 'ConfigEshopHead';
  /** List of custom HTML tags to include in the head. */
  tags: Array<Scalars['String']['output']>;
};

/** E-shop preferences configuration. */
export type ConfigEshopPreferences = {
  __typename?: 'ConfigEshopPreferences';
  /** Access control preferences. */
  access: ConfigEshopPreferencesAccess;
  /** Article folder preferences. */
  articles: Maybe<ConfigEshopPreferencesArticles>;
  /** Homepage preferences. */
  homepage: Maybe<ConfigEshopPreferencesHomepage>;
  /** Language preferences. */
  languages: ConfigEshopPreferencesLanguages;
  /** Maps preferences. */
  maps: Maybe<ConfigEshopPreferencesMaps>;
  /** Audio player preferences. */
  player: Maybe<ConfigEshopPreferencesPlayer>;
  /** Item suggestions preferences. */
  suggestions: Maybe<ConfigEshopPreferencesSuggestions>;
  /** Wantlist preferences. */
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

/** Maintenance mode preferences. */
export type ConfigEshopPreferencesAccessMaintenance = {
  __typename?: 'ConfigEshopPreferencesAccessMaintenance';
  /** Whether maintenance mode is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
  /** Message to display during maintenance. */
  message: Maybe<Scalars['String']['output']>;
  /** Password required to access the site during maintenance (optional). */
  password: Maybe<Scalars['String']['output']>;
};

/** Private access preferences. */
export type ConfigEshopPreferencesAccessPrivate = {
  __typename?: 'ConfigEshopPreferencesAccessPrivate';
  /** Whether private access is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
  /** Message to display when private access is required. */
  message: Maybe<Scalars['String']['output']>;
};

/** Article-related preferences including folder definitions. */
export type ConfigEshopPreferencesArticles = {
  __typename?: 'ConfigEshopPreferencesArticles';
  /** List of folders for organizing articles. */
  folders: Array<ConfigArticleFolder>;
};

/** Homepage preferences configuration. */
export type ConfigEshopPreferencesHomepage = {
  __typename?: 'ConfigEshopPreferencesHomepage';
  /** URL handle for the homepage content. */
  handle: Maybe<Scalars['String']['output']>;
  /** Type of homepage content (e.g., "article", "catalogue", "collection", "item"). */
  type: Scalars['String']['output'];
};

/** Language preferences configuration. */
export type ConfigEshopPreferencesLanguages = {
  __typename?: 'ConfigEshopPreferencesLanguages';
  /** List of allowed language codes. */
  whitelist: Array<Scalars['String']['output']>;
};

/** Maps preferences configuration. */
export type ConfigEshopPreferencesMaps = {
  __typename?: 'ConfigEshopPreferencesMaps';
  /** Address to display on the map. */
  address: Maybe<Address>;
  /** Whether maps are enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
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
  /** Algorithm to use for generating suggestions (e.g., "randomize"). */
  algorithm: Maybe<Scalars['String']['output']>;
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
  __typename?: 'ConfigEshopSEO';
  /** Default page description. */
  description: Maybe<Scalars['String']['output']>;
  /** Favicon URL. */
  favicon: Maybe<Scalars['String']['output']>;
  /** Default social sharing image URL. */
  image: Maybe<Scalars['String']['output']>;
  /** Whether to index the site in search engines. */
  index: Maybe<Scalars['Boolean']['output']>;
  /** Whether to index the catalogue in search engines. */
  indexCatalogue: Maybe<Scalars['Boolean']['output']>;
  /** Robots meta tag value. */
  robots: Maybe<Scalars['String']['output']>;
  /** Default page title. */
  title: Maybe<Scalars['String']['output']>;
};

/** Google services configuration. */
export type ConfigGoogle = {
  __typename?: 'ConfigGoogle';
  /** Google Analytics configuration. */
  analytics: Maybe<ConfigGoogleAnalytics>;
  /** Google Merchant Center configuration. */
  merchant: Maybe<ConfigGoogleMerchant>;
};

/** Google Analytics configuration with OAuth tokens and property settings. */
export type ConfigGoogleAnalytics = {
  __typename?: 'ConfigGoogleAnalytics';
  /** OAuth access token. */
  access_token: Maybe<Scalars['String']['output']>;
  /** Token expiry date as Unix timestamp. */
  expiry_date: Maybe<Scalars['Float']['output']>;
  /** Analytics property configuration. */
  property: Maybe<ConfigGoogleAnalyticsProperty>;
  /** OAuth refresh token. */
  refresh_token: Maybe<Scalars['String']['output']>;
  /** OAuth scope. */
  scope: Maybe<Scalars['String']['output']>;
  /** OAuth token type. */
  token_type: Maybe<Scalars['String']['output']>;
};

/** Google Analytics property configuration. */
export type ConfigGoogleAnalyticsProperty = {
  __typename?: 'ConfigGoogleAnalyticsProperty';
  /** Property identifier. */
  id: Maybe<Scalars['String']['output']>;
  /** Property name. */
  name: Maybe<Scalars['String']['output']>;
  /** Property stream configuration. */
  stream: Maybe<ConfigGoogleAnalyticsPropertyStream>;
  /** Property timezone. */
  timezone: Maybe<Scalars['String']['output']>;
};

/** Google Analytics property stream configuration. */
export type ConfigGoogleAnalyticsPropertyStream = {
  __typename?: 'ConfigGoogleAnalyticsPropertyStream';
  /** Stream identifier. */
  id: Maybe<Scalars['String']['output']>;
  /** Stream name. */
  name: Maybe<Scalars['String']['output']>;
  /** Tracking identifier. */
  tracker: Maybe<Scalars['String']['output']>;
  /** Stream type. */
  type: Maybe<Scalars['String']['output']>;
};

/** Google Merchant Center configuration. */
export type ConfigGoogleMerchant = {
  __typename?: 'ConfigGoogleMerchant';
  /** Whether Google Merchant Center is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
};

/** Inventory automation settings. */
export type ConfigInventory = {
  __typename?: 'ConfigInventory';
  /** Last copy automation configuration per item type. */
  lastCopy: Maybe<ConfigInventoryLastCopy>;
};

/** Last copy automation settings grouped by item type. */
export type ConfigInventoryLastCopy = {
  __typename?: 'ConfigInventoryLastCopy';
  BookItem: Maybe<ConfigInventoryLastCopySettings>;
  ProductItem: Maybe<ConfigInventoryLastCopySettings>;
  ReleaseItem: Maybe<ConfigInventoryLastCopyReleaseSettings>;
};

/** Last copy automation settings for release items (extends base settings with Discogs unlisting). */
export type ConfigInventoryLastCopyReleaseSettings = {
  __typename?: 'ConfigInventoryLastCopyReleaseSettings';
  comment: Maybe<Scalars['String']['output']>;
  comparePriceMultiplier: Maybe<Scalars['Float']['output']>;
  enabled: Maybe<Scalars['Boolean']['output']>;
  options: Maybe<Array<Maybe<ListingOption>>>;
  status: Maybe<Scalars['String']['output']>;
  /** Whether to unlist the release from Discogs when the last copy automation fires. */
  unlistFromDiscogs: Maybe<Scalars['Boolean']['output']>;
};

/** Last copy automation settings for a specific item type. */
export type ConfigInventoryLastCopySettings = {
  __typename?: 'ConfigInventoryLastCopySettings';
  /** Public comment to set on the listing when it becomes the last copy. */
  comment: Maybe<Scalars['String']['output']>;
  /** Multiplier applied to the sale price to set the compare-at price (e.g. 1.2 = 20% above sale price). */
  comparePriceMultiplier: Maybe<Scalars['Float']['output']>;
  /** Whether the last copy automation is enabled for this item type. */
  enabled: Maybe<Scalars['Boolean']['output']>;
  /** Listing options to apply (e.g. Media Condition, Sleeve Condition). */
  options: Maybe<Array<Maybe<ListingOption>>>;
  /** Listing status to apply: published or private. */
  status: Maybe<Scalars['String']['output']>;
};

/** Invoicing configuration. */
export type ConfigInvoicing = {
  __typename?: 'ConfigInvoicing';
  /** Business address for invoicing. */
  address: Maybe<Address>;
  /** Invoice number generator configuration. */
  generator: Maybe<ConfigInvoicingGenerator>;
  /** Business name for invoicing. */
  name: Maybe<Scalars['String']['output']>;
};

/** Invoice number generator configuration. */
export type ConfigInvoicingGenerator = {
  __typename?: 'ConfigInvoicingGenerator';
  /** Whether the generator is active. */
  active: Maybe<Scalars['Boolean']['output']>;
  /** Current counter value. */
  counter: Maybe<Scalars['Int']['output']>;
  /** Format string for invoice numbers. */
  format: Maybe<Scalars['String']['output']>;
};

/** Meta (Facebook) integration configuration. */
export type ConfigMeta = {
  __typename?: 'ConfigMeta';
  /** Meta Catalog configuration. */
  catalog: Maybe<ConfigMetaCatalog>;
  /** Meta Pixel configuration. */
  pixel: Maybe<ConfigMetaPixel>;
};

/** Meta Catalog configuration. */
export type ConfigMetaCatalog = {
  __typename?: 'ConfigMetaCatalog';
  /** Whether Meta Catalog is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
};

/** Meta Pixel configuration. */
export type ConfigMetaPixel = {
  __typename?: 'ConfigMetaPixel';
  /** Whether the Meta Pixel is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
  /** Pixel identifier. */
  id: Maybe<Scalars['String']['output']>;
};

/** Metadata configuration containing various catalog and inventory metadata. */
export type ConfigMetadata = {
  __typename?: 'ConfigMetadata';
  /** List of article metadata entries. */
  articles: Maybe<Array<ConfigMetadataArticles>>;
  /** List of book author names. */
  bookAuthors: Maybe<Array<Scalars['String']['output']>>;
  /** List of book category identifiers. */
  bookCategories: Maybe<Array<Scalars['String']['output']>>;
  /** List of book publisher identifiers. */
  bookPublishers: Maybe<Array<Scalars['String']['output']>>;
  /** List of category identifiers. */
  categories: Maybe<Array<Scalars['String']['output']>>;
  /**
   * List of book category identifiers. Use bookCategories instead.
   * @deprecated Field no longer supported
   */
  categoriesBook: Maybe<Array<Scalars['String']['output']>>;
  /**
   * List of product category identifiers. Use categories instead.
   * @deprecated Field no longer supported
   */
  categoriesProduct: Maybe<Array<Scalars['String']['output']>>;
  /** List of collection metadata entries. */
  collections: Maybe<Array<ConfigMetadataCollections>>;
  /** List of country codes. */
  countries: Maybe<Array<Scalars['String']['output']>>;
  /** List of format description identifiers. */
  formatDescriptions: Maybe<Array<Scalars['String']['output']>>;
  /** List of format identifiers. */
  formats: Maybe<Array<Scalars['String']['output']>>;
  /** List of genre identifiers. */
  genres: Maybe<Array<Scalars['String']['output']>>;
  /** Metadata identifier. */
  id: Maybe<Scalars['String']['output']>;
  /** List of location identifiers. */
  locations: Maybe<Array<Scalars['String']['output']>>;
  /** List of manufacturer identifiers. */
  manufacturers: Maybe<Array<Scalars['String']['output']>>;
  /**
   * List of medium identifiers. This field is deprecated.
   * @deprecated Field no longer supported
   */
  mediums: Maybe<Array<Scalars['String']['output']>>;
  /**
   * List of option names. Use options.names instead.
   * @deprecated Field no longer supported
   */
  optionNames: Maybe<Array<Scalars['String']['output']>>;
  /**
   * List of option values. Use options.values instead.
   * @deprecated Field no longer supported
   */
  optionValues: Maybe<Array<Scalars['String']['output']>>;
  /** Options metadata with values and names. */
  options: Maybe<ConfigMetadataOptions>;
  /** List of style identifiers. */
  styles: Maybe<Array<Scalars['String']['output']>>;
  /** List of supplier codes. */
  supplierCodes: Maybe<Array<Scalars['String']['output']>>;
  /** List of type identifiers. */
  types: Maybe<Array<Scalars['String']['output']>>;
  /** List of year values. */
  years: Maybe<Array<Scalars['Int']['output']>>;
};

/** Article metadata entry for configuration. */
export type ConfigMetadataArticles = {
  __typename?: 'ConfigMetadataArticles';
  /** URL-friendly handle for the article. */
  handle: Maybe<Scalars['String']['output']>;
  /** Numeric identifier for the article. */
  id: Maybe<Scalars['Int']['output']>;
  /** Title of the article. */
  title: Maybe<Scalars['String']['output']>;
  /** Type of the article. */
  type: Maybe<Scalars['String']['output']>;
};

/** Collection metadata entry for configuration. */
export type ConfigMetadataCollections = {
  __typename?: 'ConfigMetadataCollections';
  /** URL-friendly handle for the collection. */
  handle: Maybe<Scalars['String']['output']>;
  /** Numeric identifier for the collection. */
  id: Maybe<Scalars['Int']['output']>;
  /** Title of the collection. */
  title: Maybe<Scalars['String']['output']>;
};

/** Options metadata configuration with values and names. */
export type ConfigMetadataOptions = {
  __typename?: 'ConfigMetadataOptions';
  /** List of option names corresponding to the values. */
  names: Maybe<Array<Scalars['String']['output']>>;
  /** List of option values. */
  values: Maybe<Array<Scalars['String']['output']>>;
};

/** Recordfy integration configuration. */
export type ConfigRecordfy = {
  __typename?: 'ConfigRecordfy';
  /** Whether Recordfy is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
};

/** Social media link configuration. */
export type ConfigSocial = {
  __typename?: 'ConfigSocial';
  /** Social platform identifier (e.g., "facebook", "instagram", "twitter"). */
  id: Scalars['String']['output'];
  /** Display title for the social link. */
  title: Scalars['String']['output'];
  /** Social media URL or value. */
  value: Scalars['String']['output'];
};

/** Stack configuration information. */
export type ConfigStack = {
  __typename?: 'ConfigStack';
  /** Stack identifier. */
  id: Maybe<Scalars['ID']['output']>;
  /** Stack name. */
  name: Maybe<Scalars['String']['output']>;
  /** Stack status. */
  status: Maybe<Scalars['String']['output']>;
};

/** Statistics configuration for the shop. */
export type ConfigStatistics = {
  __typename?: 'ConfigStatistics';
  /** Campaign count statistics. */
  campaigns: Maybe<ConfigAnalyticsEntry>;
  /** Customer count statistics. */
  customers: Maybe<ConfigAnalyticsEntry>;
  /** InTouch contact count statistics. */
  inTouch: ConfigAnalyticsEntry;
  /** Inventory count statistics. */
  inventory: Maybe<ConfigAnalyticsEntry>;
  /** Invoice total statistics. */
  invoices: Maybe<ConfigAnalyticsInvoiceEntry>;
  /**
   * Item count. This field is deprecated.
   * @deprecated Field no longer supported
   */
  itemCount: Maybe<Scalars['Float']['output']>;
  /**
   * Listings count. This field is deprecated.
   * @deprecated Field no longer supported
   */
  listingsCount: Maybe<Scalars['Float']['output']>;
  /** Order count statistics. */
  orders: Maybe<ConfigAnalyticsEntry>;
  /**
   * Stock count. This field is deprecated.
   * @deprecated Field no longer supported
   */
  stockCount: Maybe<Scalars['Float']['output']>;
  /**
   * Total value. This field is deprecated.
   * @deprecated Field no longer supported
   */
  total: Maybe<Scalars['Float']['output']>;
};

/** Status configuration for the shop. */
export type ConfigStatus = {
  __typename?: 'ConfigStatus';
  /** Whether the shop is currently active. */
  active: Maybe<Scalars['Boolean']['output']>;
  /** Date when the status was set. */
  date: Maybe<Scalars['Date']['output']>;
  /** Reason for the current status. */
  reason: Maybe<Scalars['String']['output']>;
};

/** Storage configuration. */
export type ConfigStorage = {
  __typename?: 'ConfigStorage';
  /** List of backup configurations. */
  backups: Maybe<Array<Maybe<ConfigStorageBackup>>>;
  /** Database storage configuration. */
  database: Maybe<ConfigStorageDatabase>;
  /** Inventory dump configuration. */
  inventoryDump: Maybe<ConfigStorageInventoryDump>;
  /** Storage type. */
  type: Maybe<Scalars['String']['output']>;
};

/** Backup storage configuration. */
export type ConfigStorageBackup = {
  __typename?: 'ConfigStorageBackup';
  /** Date when the backup was created. */
  date: Maybe<Scalars['Date']['output']>;
  /** Backup storage key. */
  key: Maybe<Scalars['String']['output']>;
  /** Backup type (e.g., "mongodb"). */
  type: Maybe<Scalars['String']['output']>;
};

/** Database storage configuration. */
export type ConfigStorageDatabase = {
  __typename?: 'ConfigStorageDatabase';
  /** Database name. */
  name: Maybe<Scalars['String']['output']>;
};

/** Inventory dump configuration. */
export type ConfigStorageInventoryDump = {
  __typename?: 'ConfigStorageInventoryDump';
  /** Date when the inventory dump was created. */
  date: Maybe<Scalars['Date']['output']>;
  /** Whether the inventory dump is enabled. */
  enabled: Maybe<Scalars['Boolean']['output']>;
  /** Storage key for the inventory dump file. */
  key: Maybe<Scalars['String']['output']>;
};

/** Stripe customer configuration. */
export type ConfigStripe = {
  __typename?: 'ConfigStripe';
  /** Stripe customer identifier. */
  customerId: Maybe<Scalars['String']['output']>;
};

/** Tax definition with rate and name. */
export type ConfigTaxDefinition = {
  __typename?: 'ConfigTaxDefinition';
  /** Whether this is the default tax definition. */
  default: Maybe<Scalars['Boolean']['output']>;
  /** Tax definition identifier. */
  id: Maybe<Scalars['ID']['output']>;
  /** Tax name. */
  name: Scalars['String']['output'];
  /** Tax rate as a decimal (e.g., 0.20 for 20%). */
  rate: Scalars['Float']['output'];
  /** Display title for the tax. */
  title: Maybe<Scalars['String']['output']>;
};

/** Tax zone configuration (e.g., state or regional tax). */
export type ConfigTaxZone = {
  __typename?: 'ConfigTaxZone';
  /** Zone code. */
  code: Maybe<Scalars['String']['output']>;
  /** Zone name. */
  name: Maybe<Scalars['String']['output']>;
  /** Whether this zone's tax rate overrides the national rate. */
  overrideNationalTaxRate: Maybe<Scalars['Boolean']['output']>;
  /** Tax definition for this zone. */
  tax: Maybe<ConfigTaxDefinition>;
};

/** Tax configuration including VAT, country taxes, rules, and definitions. */
export type ConfigTaxes = {
  __typename?: 'ConfigTaxes';
  /** Country tax configuration. */
  country: ConfigTaxesCountry;
  /** Available tax definitions. */
  definitions: Array<ConfigTaxDefinition>;
  /** Tax collection rules. */
  rules: ConfigTaxesRules;
  /** VAT registration information. */
  vat: Maybe<ConfigTaxesVat>;
};

/** Country tax configuration. */
export type ConfigTaxesCountry = {
  __typename?: 'ConfigTaxesCountry';
  /** Economic area this country belongs to. */
  area: Maybe<ConfigTaxesCountryArea>;
  /** Country code (ISO 2-letter). */
  code: Scalars['String']['output'];
  /** Country name. */
  name: Scalars['String']['output'];
  /** National tax definition. */
  tax: Maybe<ConfigTaxDefinition>;
  /** Whether a tax zone is required for this country. */
  taxZoneRequired: Maybe<Scalars['Boolean']['output']>;
  /** Currently selected tax zone. */
  zone: Maybe<ConfigTaxZone>;
  /** Available tax zones for this country. */
  zones: Maybe<Array<ConfigTaxZone>>;
};

/** Economic area configuration for tax purposes (e.g., EU). */
export type ConfigTaxesCountryArea = {
  __typename?: 'ConfigTaxesCountryArea';
  /** Area code (e.g., "EU"). */
  code: Maybe<Scalars['String']['output']>;
  /** Area name. */
  name: Maybe<Scalars['String']['output']>;
};

/** Tax override configuration for specific countries. */
export type ConfigTaxesOverride = {
  __typename?: 'ConfigTaxesOverride';
  /** Country configuration for this override. */
  country: ConfigTaxesCountry;
  /** Tax definitions to apply. */
  taxes: Maybe<Array<ConfigTaxDefinition>>;
};

/** Tax collection rules and settings. */
export type ConfigTaxesRules = {
  __typename?: 'ConfigTaxesRules';
  /**
   * Whether to collect taxes. Use the specific collection fields instead.
   * @deprecated Use new fields instead.
   */
  collectTaxes: Maybe<Scalars['Boolean']['output']>;
  /** Whether to collect taxes within the economic area. */
  collectTaxesInArea: Maybe<Scalars['Boolean']['output']>;
  /** Whether to collect taxes in tax zones. */
  collectTaxesInZone: Maybe<Scalars['Boolean']['output']>;
  /** Whether to collect taxes at the national level. */
  collectTaxesNationally: Maybe<Scalars['Boolean']['output']>;
  /** Whether to collect taxes on shipping costs. */
  collectTaxesOnShipping: Maybe<Scalars['Boolean']['output']>;
  /** Whether to collect taxes outside the country or economic area. */
  collectTaxesOutsideCountryOrArea: Maybe<Scalars['Boolean']['output']>;
  /** Whether prices should be edited before taxes are applied. */
  editPricesBeforeTaxes: Scalars['Boolean']['output'];
  /** Whether to use European distance sales override rules. */
  europeanDistanceSalesOverride: Maybe<Scalars['Boolean']['output']>;
  /** Whether to fall back to the national tax rate if zone rate is unavailable. */
  fallbackToNationalRate: Maybe<Scalars['Boolean']['output']>;
  /** Tax overrides for specific countries. */
  overrides: Maybe<Array<ConfigTaxesOverride>>;
  /** Whether prices should be displayed before taxes. */
  showPricesBeforeTaxes: Scalars['Boolean']['output'];
};

/** VAT registration information. */
export type ConfigTaxesVat = {
  __typename?: 'ConfigTaxesVat';
  /** VAT identification number. */
  id: Maybe<Scalars['String']['output']>;
  /** Whether the VAT number has been validated. */
  validated: Maybe<Scalars['Boolean']['output']>;
};

/** Represents a contact (potential customer or lead) with personal information and list memberships. */
export type Contact = {
  __typename?: 'Contact';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Contact's address. */
  address: Maybe<Address>;
  /** Date when the contact was created. */
  createdAt: Scalars['Date']['output'];
  /** Contact's email address. */
  email: Maybe<Scalars['String']['output']>;
  /** Contact's first name. */
  firstName: Maybe<Scalars['String']['output']>;
  /** Contact's last name. */
  lastName: Maybe<Scalars['String']['output']>;
  /** Customer lists the contact is a member of. */
  lists: Array<ContactList>;
  /** Contact's full name. */
  name: Maybe<Scalars['String']['output']>;
  /** Notes or comments about the contact. */
  notes: Maybe<Scalars['String']['output']>;
  /** Organization or company name. */
  organisation: Maybe<Scalars['String']['output']>;
  /** Contact's telephone number. */
  telephone: Maybe<Scalars['String']['output']>;
  /** Date when the contact was last updated. */
  updatedAt: Scalars['Date']['output'];
};

/** Input fields for creating or updating a contact. */
export type ContactInput = {
  /** Contact's email address. */
  email?: InputMaybe<Scalars['String']['input']>;
  /** Contact's first name. */
  firstName?: InputMaybe<Scalars['String']['input']>;
  /** Contact's last name. */
  lastName?: InputMaybe<Scalars['String']['input']>;
  /** Notes or comments about the contact. */
  notes?: InputMaybe<Scalars['String']['input']>;
  /** Organization or company name. */
  organisation?: InputMaybe<Scalars['String']['input']>;
  /** Contact's telephone number. */
  telephone?: InputMaybe<Scalars['String']['input']>;
};

/** Contact's membership in a customer list. */
export type ContactList = {
  __typename?: 'ContactList';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Date when the contact was added to the list. */
  added: Maybe<Scalars['Date']['output']>;
  /** Date when the list membership was last modified. */
  lastModified: Maybe<Scalars['Date']['output']>;
  /** Opt-out information if the contact has opted out. */
  optout: Maybe<ContactListOptout>;
  /** Reference to the list. */
  ref: Maybe<Scalars['ID']['output']>;
};

/** Opt-out information for a contact list membership. */
export type ContactListOptout = {
  __typename?: 'ContactListOptout';
  /** Date when the opt-out occurred. */
  date: Maybe<Scalars['Date']['output']>;
  /** Reason for opting out. */
  reason: Maybe<Scalars['String']['output']>;
  /** Whether the contact has opted out. */
  status: Maybe<Scalars['Boolean']['output']>;
};

/** Opt-out information for a contact list membership. */
export type ContactOptout = {
  __typename?: 'ContactOptout';
  /** Date when the opt-out occurred. */
  date: Maybe<Scalars['Date']['output']>;
  /** Reason for opting out. */
  reason: Maybe<Scalars['String']['output']>;
  /** Whether the contact has opted out. */
  status: Maybe<Scalars['Boolean']['output']>;
};

/** Represents a country with tax rules, currency, language, and regional information. */
export type Country = {
  __typename?: 'Country';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** ISO 3166-1 alpha-2 country code (e.g., "US", "GB", "FR"). */
  code: Scalars['String']['output'];
  /** Whether taxes should be collected on shipping costs. */
  collectTaxesOnShipping: Scalars['Boolean']['output'];
  /** Whether taxes should be collected for transactions outside the country or area. */
  collectTaxesOutsideCountryOrArea: Scalars['Boolean']['output'];
  /** Continent where the country is located. */
  continent: Scalars['String']['output'];
  /** ISO 4217 currency code (e.g., "USD", "EUR", "GBP"). */
  currency: Scalars['String']['output'];
  /** Currency symbol (e.g., "$", "€", "£"). */
  currencySymbol: Scalars['String']['output'];
  /** Position of the currency symbol relative to the amount ("before" or "after"). */
  currencySymbolPosition: Scalars['String']['output'];
  /** Emoji flag representing the country. */
  emoji: Scalars['String']['output'];
  /** Formatted currency string combining symbol and position. */
  formattedCurrency: Scalars['String']['output'];
  /** ISO 639-1 language codes used in the country (e.g., ["en", "fr"]). */
  languages: Array<Scalars['String']['output']>;
  /** Country name. */
  name: Scalars['String']['output'];
  /** International phone number prefix for the country. */
  phoneNumberPrefix: Scalars['Int']['output'];
  /** National tax information for the country. */
  tax: Maybe<CountryTax>;
  /** Tax zones within the country with specific tax rules. */
  zones: Array<CountryZone>;
};

/** Tax information for a country or zone. */
export type CountryTax = {
  __typename?: 'CountryTax';
  /** Name of the tax (e.g., "VAT", "GST", "Sales Tax"). */
  name: Maybe<Scalars['String']['output']>;
  /** Tax rate as a percentage (e.g., 20.0 for 20%). */
  rate: Maybe<Scalars['Float']['output']>;
  /** Tax rate as a decimal fraction (e.g., 0.20 for 20%). */
  rateFraction: Maybe<Scalars['Float']['output']>;
};

/** A zone within a country that may have different tax rules. */
export type CountryZone = {
  __typename?: 'CountryZone';
  /** Zone code identifier. */
  code: Scalars['String']['output'];
  /** Zone name or description. */
  name: Scalars['String']['output'];
  /** Whether this zone overrides the national tax rate. */
  overrideNationalTaxRate: Scalars['Boolean']['output'];
  /** Tax information specific to this zone. */
  tax: Maybe<CountryTax>;
};

/** Represents a single listing in the Discogs inventory. */
export type DiscogsInventoryEntry = {
  __typename?: 'DiscogsInventoryEntry';
  /** Public comments visible to buyers. */
  comments: Maybe<Scalars['String']['output']>;
  /** Media condition of the item. */
  condition: Maybe<Scalars['String']['output']>;
  /** Whether there is a discrepancy between Discogs and local inventory. */
  discrepancy: Maybe<Scalars['Boolean']['output']>;
  /** Whether the listing exists in the local inventory system. */
  exists: Maybe<Scalars['Boolean']['output']>;
  /** Discogs listing identifier. */
  id: Scalars['String']['output'];
  /** Physical location of the item. */
  location: Maybe<Scalars['String']['output']>;
  /** Original price of the listing before any updates. */
  original_price: Maybe<DiscogsInventoryEntryPrice>;
  /** URL path to the listing. */
  path: Maybe<Scalars['String']['output']>;
  /** Date when the listing was posted to Discogs. */
  posted: Maybe<Scalars['String']['output']>;
  /** Current price of the listing. */
  price: DiscogsInventoryEntryPrice;
  /** Private comments for internal use only. */
  privateComments: Maybe<Scalars['String']['output']>;
  /** Release information for this listing. */
  release: DiscogsInventoryEntryRelease;
  /** Sleeve condition of the item. */
  sleeve_condition: Maybe<Scalars['String']['output']>;
  /** URI to access the listing on Discogs. */
  uri: Maybe<Scalars['String']['output']>;
};

/** Price information for a Discogs inventory entry. */
export type DiscogsInventoryEntryPrice = {
  __typename?: 'DiscogsInventoryEntryPrice';
  /** Currency abbreviation. */
  curr_abbr: Maybe<Scalars['String']['output']>;
  /** Currency code. */
  currency: Maybe<Scalars['String']['output']>;
  /** Formatted price string. */
  formatted: Maybe<Scalars['String']['output']>;
  /** Numeric price value. */
  value: Maybe<Scalars['Float']['output']>;
};

/** Release information for a Discogs inventory entry. */
export type DiscogsInventoryEntryRelease = {
  __typename?: 'DiscogsInventoryEntryRelease';
  /** Description of the release. */
  description: Maybe<Scalars['String']['output']>;
  /** Discogs release identifier. */
  id: Scalars['Int']['output'];
  /** URL to the release thumbnail image. */
  thumbnail: Maybe<Scalars['String']['output']>;
};

/** Paginated page of Discogs inventory listings. */
export type DiscogsInventoryPage = {
  __typename?: 'DiscogsInventoryPage';
  /** List of Discogs inventory entries on this page. */
  listings: Array<DiscogsInventoryEntry>;
  /** Pagination information. */
  pagination: Pagination;
  /** Statistics for the inventory page. */
  stats: DiscogsInventoryPageStats;
};

/** Statistics for a page of Discogs inventory results. */
export type DiscogsInventoryPageStats = {
  __typename?: 'DiscogsInventoryPageStats';
  /** Total number of items found matching the query. */
  foundItems: Maybe<Scalars['Int']['output']>;
};

/** Buyer information for a Discogs order. */
export type DiscogsOrderBuyer = {
  __typename?: 'DiscogsOrderBuyer';
  /** Discogs user identifier. */
  id: Maybe<Scalars['Int']['output']>;
  /** Resource URL for the buyer's Discogs profile. */
  resource_url: Maybe<Scalars['String']['output']>;
  /** Discogs username of the buyer. */
  username: Maybe<Scalars['String']['output']>;
};

/** Represents a single order from Discogs. */
export type DiscogsOrderEntry = {
  __typename?: 'DiscogsOrderEntry';
  /** Additional shipping instructions. */
  additional_instructions: Maybe<Scalars['String']['output']>;
  /** Whether the order has been archived. */
  archived: Maybe<Scalars['Boolean']['output']>;
  /** Buyer information for the order. */
  buyer: DiscogsOrderBuyer;
  /** Date when the order was created. */
  created: Maybe<Scalars['Date']['output']>;
  /** Discogs fee for the order. */
  fee: Maybe<DiscogsOrderFee>;
  /** Discogs order identifier. */
  id: Scalars['String']['output'];
  /** Whether the order has been imported into the local system. */
  imported: Scalars['Boolean']['output'];
  /** List of items in the order. */
  items: Array<DiscogsOrderEntryItem>;
  /** Date of the last activity on the order. */
  last_activity: Maybe<Scalars['Date']['output']>;
  /** List of possible next status values for the order. */
  next_status: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  /** Shipping address for the order. */
  shipping_address: Maybe<Scalars['String']['output']>;
  /** Current status of the order. */
  status: Scalars['String']['output'];
  /** Total amount of the order. */
  total: DiscogsOrderFee;
  /** URI to access the order on Discogs. */
  uri: Scalars['String']['output'];
};

/** Represents a single item within a Discogs order. */
export type DiscogsOrderEntryItem = {
  __typename?: 'DiscogsOrderEntryItem';
  /** Discogs listing identifier. */
  id: Scalars['Long']['output'];
  /** Media condition of the item. */
  media_condition: Maybe<Scalars['String']['output']>;
  /** Price of the item. */
  price: DiscogsOrderFee;
  /** Release information for this order item. */
  release: DiscogsOrderEntryItemRelease;
  /** Sleeve condition of the item. */
  sleeve_condition: Maybe<Scalars['String']['output']>;
  /** Current status and availability of the item. */
  state: Maybe<DiscogsOrderEntryItemStatus>;
};

/** Release information for an item in a Discogs order. */
export type DiscogsOrderEntryItemRelease = {
  __typename?: 'DiscogsOrderEntryItemRelease';
  /** Description of the release. */
  description: Scalars['String']['output'];
  /** Discogs release identifier. */
  id: Scalars['Int']['output'];
};

/** Status information for an item in a Discogs order. */
export type DiscogsOrderEntryItemStatus = {
  __typename?: 'DiscogsOrderEntryItemStatus';
  /** Whether the item is currently available. */
  available: Scalars['Boolean']['output'];
  /** Path or URL related to the item status. */
  path: Maybe<Scalars['String']['output']>;
};

/** Fee or price information with currency. */
export type DiscogsOrderFee = {
  __typename?: 'DiscogsOrderFee';
  /** Currency code. */
  currency: Scalars['String']['output'];
  /** Fee or price value as a string. */
  value: Scalars['String']['output'];
};

/** Paginated page of Discogs orders. */
export type DiscogsOrdersPage = {
  __typename?: 'DiscogsOrdersPage';
  /** List of Discogs orders on this page. */
  orders: Array<DiscogsOrderEntry>;
  /** Pagination information. */
  pagination: Pagination;
};

/** Results from searching the Discogs database. */
export type DiscogsSearchResults = {
  __typename?: 'DiscogsSearchResults';
  /** Pagination information for the search results. */
  pagination: Maybe<Pagination>;
  /** List of release search results. */
  results: Maybe<Array<DiscogsSearchResultsEntry>>;
};

/** Represents a single release result from a Discogs search. */
export type DiscogsSearchResultsEntry = {
  __typename?: 'DiscogsSearchResultsEntry';
  /** Catalog number of the release. */
  catno: Maybe<Scalars['String']['output']>;
  /** Country where the release was issued. */
  country: Maybe<Scalars['String']['output']>;
  /** List of format names. */
  format: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  /** Detailed format information. */
  formats: Maybe<Array<Maybe<DiscogsSearchResultsEntryFormat>>>;
  /** List of genres associated with the release. */
  genre: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  /** Discogs release identifier. */
  id: Maybe<Scalars['Int']['output']>;
  /** List of labels that released the record. */
  label: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  /** Resource URL for the release. */
  resource_url: Maybe<Scalars['String']['output']>;
  /** List of musical styles associated with the release. */
  style: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  /** URL to the thumbnail image. */
  thumb: Maybe<Scalars['String']['output']>;
  /** Title of the release. */
  title: Maybe<Scalars['String']['output']>;
  /** Type of the release, typically "release". */
  type: Maybe<Scalars['String']['output']>;
  /** URI to access the release on Discogs. */
  uri: Maybe<Scalars['String']['output']>;
  /** Year the release was issued. */
  year: Maybe<Scalars['String']['output']>;
};

/** Format information for a Discogs search result entry. */
export type DiscogsSearchResultsEntryFormat = {
  __typename?: 'DiscogsSearchResultsEntryFormat';
  /** List of format descriptions. */
  descriptions: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  /** Name of the format. */
  name: Maybe<Scalars['String']['output']>;
  /** Quantity of the format. */
  qty: Maybe<Scalars['String']['output']>;
  /** Additional text description of the format. */
  text: Maybe<Scalars['String']['output']>;
};

/** Email recipient information with timestamp. */
export type EmailRecipient = {
  __typename?: 'EmailRecipient';
  /** Date when the email was sent. */
  date: Scalars['Date']['output'];
  /** Email address of the recipient. */
  recipient: Scalars['String']['output'];
};

export type FeedConfig = {
  __typename?: 'FeedConfig';
  _id: Scalars['ID']['output'];
  name: Maybe<Scalars['String']['output']>;
  thumbnail: Maybe<Scalars['String']['output']>;
  uri: Maybe<Scalars['String']['output']>;
};

export type FeedInterval = {
  __typename?: 'FeedInterval';
  _id: Scalars['ID']['output'];
  config: Maybe<FeedConfig>;
  created: Maybe<Scalars['Date']['output']>;
  posts: Array<FeedPost>;
};

export type FeedItemInput = {
  artwork: Scalars['String']['input'];
  hasAudio: Scalars['Boolean']['input'];
  isPreorder: Scalars['Boolean']['input'];
  ref: Scalars['ID']['input'];
  uri: Scalars['String']['input'];
};

export type FeedPost = {
  __typename?: 'FeedPost';
  _id: Scalars['ID']['output'];
  config: Maybe<FeedConfig>;
  from: Maybe<Scalars['String']['output']>;
  isFavorite: Maybe<Scalars['Boolean']['output']>;
  item: Maybe<FeedPostItem>;
  timestamp: Maybe<Scalars['String']['output']>;
  type: Maybe<Scalars['String']['output']>;
};

export type FeedPostItem = {
  __typename?: 'FeedPostItem';
  _id: Scalars['ID']['output'];
  artwork: Scalars['String']['output'];
  hasAudio: Maybe<Scalars['Boolean']['output']>;
  isPreorder: Maybe<Scalars['Boolean']['output']>;
  uri: Scalars['String']['output'];
};

/** Represents metadata about an uploaded file. */
export type File = {
  __typename?: 'File';
  /** Character encoding of the file content. */
  encoding: Scalars['String']['output'];
  /** Original filename of the uploaded file. */
  filename: Scalars['String']['output'];
  /** MIME type of the file, such as image/jpeg or application/pdf. */
  mimetype: Scalars['String']['output'];
};

/** Enumeration of message sender types for filtering messages. */
export type FromEnum =
  /** Messages sent by administrators. */
  | 'admin'
  /** Messages sent by buyers or customers. */
  | 'buyer';

/** Input fields for specifying geographic coordinates using GeoJSON format. */
export type GeoLocInput = {
  /** Array of coordinates in [longitude, latitude] format. */
  coordinates: Array<Scalars['Float']['input']>;
  /** GeoJSON geometry type, typically Point. */
  type: Scalars['String']['input'];
};

/** Paginated inventory results with item entries. The pagination, metadata, and stats fields are deprecated in favor of using the inventoryMetadata query. */
export type Inventory = {
  __typename?: 'Inventory';
  /** List of items in the current page. */
  entries: Array<Item>;
  /**
   * Metadata about the inventory including categories, supplier codes, and locations. This field is deprecated; use the inventoryMetadata query instead.
   * @deprecated Field no longer supported
   */
  metadata: Maybe<InventoryMetadata>;
  /**
   * Pagination information. This field is deprecated; use the inventoryMetadata query for pagination.
   * @deprecated Field no longer supported
   */
  pagination: Pagination;
  /**
   * Statistical summary of the inventory. This field is deprecated; use the inventoryMetadata query instead.
   * @deprecated Field no longer supported
   */
  stats: Maybe<InventoryStats>;
};

/** Estimated processing time for bulk inventory operations, including a human-readable duration string. */
export type InventoryBulkEstimate = {
  __typename?: 'InventoryBulkEstimate';
  /** Human-readable duration string representing the estimated processing time. */
  durationString: Maybe<Scalars['String']['output']>;
  /** Estimated processing time in milliseconds for the bulk operation. */
  estimatedProcessTime: Maybe<Scalars['Int']['output']>;
};

/** Response containing the URI to the exported stickers file. */
export type InventoryExportStickersResponse = {
  __typename?: 'InventoryExportStickersResponse';
  /** URI to access the exported stickers file. */
  uri: Maybe<Scalars['String']['output']>;
};

/** Comprehensive filter input for inventory queries, supporting filtering by stock, status, type, location, categories, dates, and more. Used by the inventory and inventoryMetadata queries. */
export type InventoryFilters = {
  /** List of artist IDs (Discogs IDs) to filter by. */
  artists?: InputMaybe<Array<Scalars['Float']['input']>>;
  /** Date range filter for listing available dates. Provide an array with two Date values: [startDate, endDate]. */
  availableDate?: InputMaybe<Array<InputMaybe<Scalars['Date']['input']>>>;
  /** List of category names to filter by. */
  categories?: InputMaybe<Array<Scalars['String']['input']>>;
  /** List of media condition values to filter by (e.g., "Mint", "Near Mint", "Very Good", "Good", "Fair", "Poor"). */
  condition?: InputMaybe<Array<Scalars['String']['input']>>;
  /** List of country codes to filter by (ISO 3166-1 alpha-2 format, e.g., "US", "GB", "FR"). */
  countries?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Reference ID of the admin user who created the item. Filters items created by this specific admin. */
  createdBy?: InputMaybe<Scalars['ID']['input']>;
  /** Date range filter for item creation dates. Provide an array with two Date values: [startDate, endDate]. */
  createdDate?: InputMaybe<Array<InputMaybe<Scalars['Date']['input']>>>;
  /**
   * Date filter type. This field is deprecated; use specific date filters (availableDate, publishedDate, createdDate) instead.
   * @deprecated Use date filters instead
   */
  dateFilter?: InputMaybe<Scalars['String']['input']>;
  /** Discogs listing status filter. Valid values include "listed" (listed on Discogs), "unlisted" (not listed on Discogs), or "all" (no filtering). */
  discogsStatus?: InputMaybe<Scalars['String']['input']>;
  /** List of item reference IDs to filter by. Returns only items with these specific reference IDs. */
  filteredIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** List of format description strings to filter by (e.g., "LP", "CD", "Cassette", "7"", "12""). */
  formatDescriptions?: InputMaybe<Array<Scalars['String']['input']>>;
  /** List of format names to filter by (e.g., "Vinyl", "CD", "Cassette"). */
  formats?: InputMaybe<Array<Scalars['String']['input']>>;
  /**
   * Start date for date range filtering. This field is deprecated; use date filters (availableDate, publishedDate, createdDate) instead.
   * @deprecated Use date filters instead
   */
  from?: InputMaybe<Scalars['String']['input']>;
  /** List of genre names to filter by (e.g., "Electronic", "Rock", "Jazz"). */
  genres?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Whether to filter for gift card products only. If true, returns only product items configured to generate gift cards. */
  giftCards?: InputMaybe<Scalars['Boolean']['input']>;
  /** Filter for items with audio available. Valid values include true (items with audio), false (items without audio), undefined (no filtering). */
  hasAudio?: InputMaybe<Scalars['Boolean']['input']>;
  /** Deprecated: Filter for items with audio snippets. Valid values include "true" (items with snippets), "false" (items without snippets), or "all" (no filtering). */
  hasSnippet?: InputMaybe<Scalars['String']['input']>;
  /** Specific item ID to filter by. */
  itemId?: InputMaybe<Scalars['Float']['input']>;
  /** List of item types to filter by. Valid values include "ReleaseItem", "BookItem", or "ProductItem". */
  itemTypes?: InputMaybe<Array<Scalars['String']['input']>>;
  /** List of label IDs to filter by. */
  labels?: InputMaybe<Array<Scalars['Int']['input']>>;
  /** Number of items per page. You can request a specific page size, and it will be used if it does not exceed the server-enforced maximum. If your requested size exceeds the maximum, the server will enforce the maximum limit. */
  limit?: InputMaybe<Scalars['Int']['input']>;
  /** List of listing reference IDs to filter by. Returns items that contain any of these listings. */
  listingRefs?: InputMaybe<Array<Scalars['String']['input']>>;
  /** List of location names to filter by. */
  location?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Search term to filter locations by name. */
  locationSearch?: InputMaybe<Scalars['String']['input']>;
  /** List of manufacturer names to filter by. */
  manufacturers?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Sort order: 1 for ascending, -1 for descending. */
  order?: InputMaybe<Scalars['Int']['input']>;
  /** The requested page number. Defaults to 1 if not specified. */
  page?: InputMaybe<Scalars['Int']['input']>;
  /** Whether to filter for pre-order listings only. If true, returns only listings marked as pre-order. */
  preOrder?: InputMaybe<Scalars['Boolean']['input']>;
  /** List of product type names to filter by. */
  productTypes?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Date range filter for listing published dates. Provide an array with two Date values: [startDate, endDate]. */
  publishedDate?: InputMaybe<Array<InputMaybe<Scalars['Date']['input']>>>;
  /** Whether to filter for second-hand items only. If true, returns only listings marked as second-hand. */
  secondHand?: InputMaybe<Scalars['Boolean']['input']>;
  /** List of sleeve condition values to filter by (e.g., "Mint", "Near Mint", "Very Good", "Good", "Fair", "Poor"). */
  sleeveCondition?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Field name to sort results by. Valid values include "created" (creation date), "title" (item title), "stock" (stock quantity), or other item fields. */
  sort?: InputMaybe<Scalars['String']['input']>;
  /** Listing status filter. Valid values include "published" (visible to customers), "draft" (not visible), or "private" (visible only to admins). */
  status?: InputMaybe<Scalars['String']['input']>;
  /** Stock filter. Valid values include "inStock" (items with stock > 0), "outOfStock" (items with stock = 0), or "all" (no stock filtering). */
  stock?: InputMaybe<Scalars['String']['input']>;
  /** List of style names to filter by (e.g., "House", "Techno", "Ambient"). */
  styles?: InputMaybe<Array<Scalars['String']['input']>>;
  /** List of supplier codes to filter by. */
  supplierCode?: InputMaybe<Array<Scalars['String']['input']>>;
  /** List of supplier IDs to filter by. */
  suppliers?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Search term to filter items by. Performs a case-insensitive search on item titles, descriptions, barcodes, SKUs, identifiers, or IDs. */
  term?: InputMaybe<Scalars['String']['input']>;
  /**
   * End date for date range filtering. This field is deprecated; use date filters (availableDate, publishedDate, createdDate) instead.
   * @deprecated Use date filters instead
   */
  to?: InputMaybe<Scalars['String']['input']>;
  /**
   * Item type filter (e.g., "ReleaseItem", "BookItem", "ProductItem"). This field is deprecated; use itemTypes instead.
   * @deprecated Use itemTypes instead
   */
  type?: InputMaybe<Scalars['String']['input']>;
  /** List of release years to filter by. */
  years?: InputMaybe<Array<Scalars['Int']['input']>>;
};

/** Paginated list of inventory location names with pagination information. */
export type InventoryLocations = {
  __typename?: 'InventoryLocations';
  /** List of location names in the current page. */
  entries: Array<Scalars['String']['output']>;
  /** Pagination information including page number, total count, and limit. */
  pagination: Pagination;
};

/** Metadata about inventory including pagination, metadata, and statistical summary. */
export type InventoryMetadata = {
  __typename?: 'InventoryMetadata';
  /** List of unique category names available in the inventory. */
  categories: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  /** List of unique location names available in the inventory. */
  locations: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  /** Metadata about the inventory including categories, supplier codes, and locations. */
  metadata: Maybe<InventoryMetadata>;
  /** Pagination information including page number, total count, and limit. */
  pagination: Maybe<Pagination>;
  /** Statistical summary of the inventory including total count, stock count, and listings count. */
  stats: Maybe<InventoryStats>;
  /** List of unique supplier codes available in the inventory. */
  supplierCodes: Maybe<Array<Maybe<Scalars['String']['output']>>>;
};

/** Statistical summary of inventory items, including total count, stock count, and listings count. */
export type InventoryStats = {
  __typename?: 'InventoryStats';
  /** Total number of listings across all items. */
  listingsCount: Maybe<Scalars['Float']['output']>;
  /** Total number of items with stock quantity greater than 0. */
  stockCount: Maybe<Scalars['Float']['output']>;
  /** Total number of items in the inventory. */
  total: Maybe<Scalars['Float']['output']>;
};

/** Paginated list of suppliers associated with inventory items with pagination information. */
export type InventorySuppliers = {
  __typename?: 'InventorySuppliers';
  /** Pagination information including page number, total count, and limit. */
  pagination: Pagination;
  /** List of suppliers in the current page. */
  suppliers: Array<Supplier>;
};

/** Represents a base inventory item with listings and metadata. */
export type Item = {
  __typename?: 'Item';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Shortened URL via Bitly service. */
  bitly: Maybe<Scalars['String']['output']>;
  /** Date when the item was created. */
  created: Maybe<Scalars['Date']['output']>;
  /** Identifier linking this item to the Creators catalogue. */
  creatorsId: Maybe<Scalars['String']['output']>;
  /** Base item data and metadata. */
  data: ItemData;
  /** Item descriptions in multiple formats. */
  descriptions: ItemDescriptions;
  /**
   * URL-friendly handle for the item.
   * @deprecated Field no longer supported
   */
  handle: Maybe<Scalars['String']['output']>;
  /** Numeric identifier for the item. */
  id: Scalars['Float']['output'];
  /** Incremental identifier assigned to the item. */
  incId: Maybe<Scalars['Float']['output']>;
  /** Whether the item is forbidden from being sold. */
  isForbiddenForSale: Maybe<Scalars['Boolean']['output']>;
  /** Available listings for this item. */
  listings: Array<Listing>;
  /**
   * Historical log entries for the item.
   * @deprecated Field no longer supported
   */
  logs: Maybe<Array<Maybe<LogEntry>>>;
  /** Date when the item was last modified. */
  modified: Maybe<Scalars['Date']['output']>;
  /** Legacy numeric identifier from previous system. */
  oldId: Maybe<Scalars['Float']['output']>;
  /** URL path to the item page. */
  path: Scalars['String']['output'];
  /** SEO metadata for the item. */
  seo: Maybe<SeoEntry>;
  /** Type classification of the item. */
  type: ItemType;
  /** Unique identifier string for the item. */
  uniqueId: Maybe<Scalars['String']['output']>;
  /** URI identifier for the item. */
  uri: Maybe<Scalars['String']['output']>;
  /** Number of users who have added this item to their wantlist. */
  wants: Maybe<Scalars['Int']['output']>;
};

/** Search results for item artists with pagination information. */
export type ItemArtistsResult = {
  __typename?: 'ItemArtistsResult';
  /** List of artists matching the search criteria. */
  artists: Array<ItemArtistsResultArtist>;
  /** Pagination information for the search results. */
  pagination: Maybe<Pagination>;
};

/** Artist entry in item artists search results, containing the artist ID and name. */
export type ItemArtistsResultArtist = {
  __typename?: 'ItemArtistsResultArtist';
  /** Numeric artist ID (Discogs ID). */
  id: Scalars['Long']['output'];
  /** Name of the artist. */
  name: Scalars['String']['output'];
};

/** Response for audio upload operations, containing the signed URL, URI, and item. */
export type ItemAudioUploadResponse = {
  __typename?: 'ItemAudioUploadResponse';
  key: Maybe<Scalars['String']['output']>;
  signedUrl: Maybe<Scalars['String']['output']>;
  uri: Maybe<Scalars['String']['output']>;
};

/** Input fields for creating or updating a book item, including bibliographic information and metadata. */
export type ItemBookInput = {
  /** Link to an external asset or resource related to the book. */
  assetLink?: InputMaybe<Scalars['String']['input']>;
  /** List of author names. */
  authors?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  /** List of category or genre names for the book. */
  categories?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  /** Physical format of the book (e.g., "Hardcover", "Paperback", "eBook"). */
  format?: InputMaybe<Scalars['String']['input']>;
  /** List of identifiers such as ISBN-10, ISBN-13, or other catalog numbers. */
  identifiers?: InputMaybe<Array<InputMaybe<ItemIdentifierInput>>>;
  /** List of images associated with the book, typically including cover images. */
  images?: InputMaybe<Array<InputMaybe<ItemImageInput>>>;
  /** Language code of the book content (e.g., "en", "fr", "de"). */
  language?: InputMaybe<Scalars['String']['input']>;
  /** Total number of pages in the book. */
  pageCount?: InputMaybe<Scalars['Int']['input']>;
  /** Publication date of the book. */
  publishedDate?: InputMaybe<Scalars['Date']['input']>;
  /** Publisher name. */
  publisher?: InputMaybe<Scalars['String']['input']>;
  /** Subtitle of the book, if applicable. */
  subtitle?: InputMaybe<Scalars['String']['input']>;
  /** Title of the book. */
  title?: InputMaybe<Scalars['String']['input']>;
  /** Weight of the book in grams. */
  weight?: InputMaybe<Scalars['Int']['input']>;
};

/** Search results from external book databases, containing entries from Google Books and ISBNdb. */
export type ItemBookSearchResults = {
  __typename?: 'ItemBookSearchResults';
  /** List of book search results from Google Books. */
  google: Maybe<Array<ItemBookSearchResultsEntry>>;
  /** List of book search results from ISBNdb. */
  isbndb: Maybe<Array<ItemBookSearchResultsEntry>>;
};

/** Book search result entry from external book databases, containing bibliographic information and metadata. */
export type ItemBookSearchResultsEntry = {
  __typename?: 'ItemBookSearchResultsEntry';
  /** List of author names. */
  authors: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  /** Description or summary of the book. */
  description: Maybe<Scalars['String']['output']>;
  /** List of identifiers such as ISBN-10, ISBN-13, or other catalog numbers. */
  identifiers: Maybe<Array<Maybe<ItemDataIdentifier>>>;
  /** List of images associated with the book, typically including cover images. */
  images: Maybe<Array<Maybe<ReleaseImage>>>;
  /** Language code of the book content. */
  language: Maybe<Scalars['String']['output']>;
  /** Total number of pages in the book. */
  pageCount: Maybe<Scalars['Int']['output']>;
  /** Publisher name. */
  publisher: Maybe<Scalars['String']['output']>;
  /** Subtitle of the book, if applicable. */
  subtitle: Maybe<Scalars['String']['output']>;
  /** Thumbnail image URI for the book cover. */
  thumb: Maybe<Scalars['String']['output']>;
  /** Title of the book. */
  title: Maybe<Scalars['String']['output']>;
};

/** Input fields for bulk updating multiple listings, specifying the field to update and its new value. */
export type ItemBulkUpdate = {
  /** Listing reference ID or identifier for the listing to update. */
  id?: InputMaybe<Scalars['String']['input']>;
  /** Title of the item or listing (used for identification in bulk operations). */
  title?: InputMaybe<Scalars['String']['input']>;
  /** Type of update to perform (e.g., "stock", "price", "status", etc.). */
  updateType?: InputMaybe<Scalars['String']['input']>;
  /** New value for the field being updated, provided as JSON to support various data types. */
  value?: InputMaybe<Scalars['JSON']['input']>;
};

/** Base data structure for item metadata and identifiers. */
export type ItemData = {
  __typename?: 'ItemData';
  /** Artists associated with the release. */
  artists: Maybe<Array<ReleaseArtist>>;
  /** Link to associated digital asset or resource. */
  assetLink: Maybe<Scalars['String']['output']>;
  /** Authors of the book. */
  authors: Maybe<Array<Scalars['String']['output']>>;
  /** Category classification for the product. */
  cat: Maybe<Scalars['String']['output']>;
  /** Categories the book belongs to. */
  categories: Maybe<Array<Scalars['String']['output']>>;
  /** Country of origin or release country code. */
  country: Maybe<Scalars['String']['output']>;
  /** External identifier from the marketplace system. */
  discogsId: Maybe<Scalars['Float']['output']>;
  /** Format description of the book (e.g., "Hardcover", "Paperback"). */
  format: Maybe<Scalars['String']['output']>;
  /** Format information for the release. */
  formats: Maybe<Array<ReleaseFormat>>;
  /** Musical genres associated with the release. */
  genres: Maybe<Array<Scalars['String']['output']>>;
  /** Gift card configuration if this product generates gift cards. */
  giftCard: Maybe<ProductGiftCard>;
  /** Numeric identifier for the item data. */
  id: Maybe<Scalars['Float']['output']>;
  /** Identifiers associated with the release (e.g., barcodes, catalog numbers). */
  identifiers: Maybe<Array<ItemDataIdentifier>>;
  /** Images associated with the release. */
  images: Array<ReleaseImage>;
  /**
   * Industry identifiers for the book (e.g., ISBN, ASIN).
   * @deprecated use identifiers instead
   */
  industryIdentifiers: Maybe<Array<Maybe<BookIdentifier>>>;
  /** Record labels associated with the release. */
  labels: Maybe<Array<ReleaseLabel>>;
  /** Language of the book (ISO 639-1 code). */
  language: Maybe<Scalars['String']['output']>;
  /** Manufacturer name of the product. */
  manufacturer: Maybe<Scalars['String']['output']>;
  /** Maturity rating for the book (e.g., "NOT_MATURE", "MATURE"). */
  maturityRating: Maybe<Scalars['String']['output']>;
  /** Number of pages in the book. */
  pageCount: Maybe<Scalars['Int']['output']>;
  /** Publication date of the book. */
  publishedDate: Maybe<Scalars['Date']['output']>;
  /** Publisher of the book. */
  publisher: Maybe<Scalars['String']['output']>;
  /** Release date of the item. */
  releaseDate: Maybe<Scalars['Date']['output']>;
  /** Search index text for the book. */
  search: Maybe<Scalars['String']['output']>;
  /** Reference ID of the audio snippet associated with this item. */
  snippetRef: Maybe<Scalars['ID']['output']>;
  /** Musical styles associated with the release. */
  styles: Maybe<Array<Scalars['String']['output']>>;
  /** Subtitle of the book. */
  subtitle: Maybe<Scalars['String']['output']>;
  /** Thumbnail image URL or identifier. */
  thumb: Maybe<Scalars['String']['output']>;
  /** Title of the release. */
  title: Scalars['String']['output'];
  /** Track listing for the release. */
  tracklist: Maybe<Array<ReleaseTrack>>;
  /** Product type classification. */
  type: Maybe<Scalars['String']['output']>;
  /** Videos associated with the release. */
  videos: Maybe<Array<Maybe<ReleaseVideo>>>;
  /** Weight of the item in grams or specified unit. */
  weight: Maybe<Scalars['Float']['output']>;
  /** Year of release. */
  year: Maybe<Scalars['Int']['output']>;
};

/** Identifier for an item (e.g., barcode, catalog number, ISBN). */
export type ItemDataIdentifier = {
  __typename?: 'ItemDataIdentifier';
  /** Description of the identifier. */
  description: Maybe<Scalars['String']['output']>;
  /** Display text for the identifier. */
  text: Maybe<Scalars['String']['output']>;
  /** Type of identifier (e.g., "Barcode", "Catalog Number", "ISBN"). */
  type: Maybe<Scalars['String']['output']>;
  /** The identifier value. */
  value: Maybe<Scalars['String']['output']>;
};

/** Item descriptions in multiple formats for different contexts. */
export type ItemDescriptions = {
  __typename?: 'ItemDescriptions';
  /** Main description text for the item. */
  main: Scalars['String']['output'];
  /** Shop-specific description content in multiple formats. */
  shop: ItemDescriptionsShop;
};

/** Shop-specific description content for an item in multiple formats. */
export type ItemDescriptionsShop = {
  __typename?: 'ItemDescriptionsShop';
  /** HTML-formatted description for the shop. */
  html: Maybe<Scalars['String']['output']>;
  /** Short summary description for the shop. */
  short: Maybe<Scalars['String']['output']>;
  /** Plain text description for the shop. */
  text: Maybe<Scalars['String']['output']>;
};

/** Statistics from Discogs marketplace for a release, including collection counts and price statistics. */
export type ItemDiscogsStatistics = {
  __typename?: 'ItemDiscogsStatistics';
  /** Number of users who have this release in their collection. */
  have: Maybe<Scalars['Int']['output']>;
  /** Highest price this release has sold for on Discogs. */
  highest: Maybe<Scalars['String']['output']>;
  /** Date of the last sale of this release on Discogs. */
  lastSold: Maybe<Scalars['String']['output']>;
  /** Lowest price this release has sold for on Discogs. */
  lowest: Maybe<Scalars['String']['output']>;
  /** Median price this release has sold for on Discogs. */
  median: Maybe<Scalars['String']['output']>;
  /** Number of users who want this release. */
  want: Maybe<Scalars['Int']['output']>;
};

/** Result of generating a short link for an item, containing the item and the generated URI. */
export type ItemGenerateLinkResult = {
  __typename?: 'ItemGenerateLinkResult';
  /** The item for which the link was generated. */
  item: Maybe<Item>;
  /** Generated short URI for the item. */
  uri: Maybe<Scalars['String']['output']>;
};

/** Input fields for item identifiers such as ISBN, barcode, or catalog numbers. */
export type ItemIdentifierInput = {
  /** Optional description or label for the identifier. */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Type of identifier, such as "ISBN_10", "ISBN_13", "UPC", "EAN", or "CATALOG_NUMBER". */
  type?: InputMaybe<Scalars['String']['input']>;
  /** The identifier value itself. */
  value?: InputMaybe<Scalars['String']['input']>;
};

/** Input fields for item images, including dimensions and alternative image references. */
export type ItemImageInput = {
  /** Alternative image variant, typically used for different sizes or formats. */
  alternative?: InputMaybe<ItemImageInput>;
  /** Height of the image in pixels. */
  height?: InputMaybe<Scalars['Float']['input']>;
  /** URI or URL of the image. */
  uri?: InputMaybe<Scalars['String']['input']>;
  /** Width of the image in pixels. */
  width?: InputMaybe<Scalars['Float']['input']>;
};

/** Response containing a pre-signed URL for uploading an item image and the storage key. */
export type ItemImageSignedUrlResponse = {
  __typename?: 'ItemImageSignedUrlResponse';
  /** Storage key to use when registering the uploaded image with itemImageRegister. */
  key: Scalars['String']['output'];
  /** Pre-signed URL for uploading the image file to cloud storage. */
  signedUrl: Scalars['String']['output'];
};

/** Input fields for item descriptions, including short and long text descriptions. */
export type ItemInputDescriptions = {
  /** Long description of the item, typically used for detailed product pages. */
  long?: InputMaybe<Scalars['String']['input']>;
  /** Short description or summary of the item, typically used in listings and previews. */
  short?: InputMaybe<Scalars['String']['input']>;
};

/** Base interface for all item types with common fields. */
export type ItemInterface = {
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Shortened URL via Bitly service. */
  bitly: Maybe<Scalars['String']['output']>;
  /** Date when the item was created. */
  created: Maybe<Scalars['Date']['output']>;
  /** Identifier linking this item to the Creators catalogue. */
  creatorsId: Maybe<Scalars['String']['output']>;
  /** Item descriptions in multiple formats. */
  descriptions: ItemDescriptions;
  /**
   * URL-friendly handle for the item.
   * @deprecated Field no longer supported
   */
  handle: Maybe<Scalars['String']['output']>;
  /** Numeric identifier for the item. */
  id: Scalars['Float']['output'];
  /** Incremental identifier assigned to the item. */
  incId: Maybe<Scalars['Float']['output']>;
  /** Whether the item is forbidden from being sold. */
  isForbiddenForSale: Maybe<Scalars['Boolean']['output']>;
  /** Available listings for this item. */
  listings: Array<Listing>;
  /**
   * Historical log entries for the item.
   * @deprecated Field no longer supported
   */
  logs: Maybe<Array<Maybe<LogEntry>>>;
  /** Date when the item was last modified. */
  modified: Maybe<Scalars['Date']['output']>;
  /** Legacy numeric identifier from previous system. */
  oldId: Maybe<Scalars['Float']['output']>;
  /** URL path to the item page. */
  path: Scalars['String']['output'];
  /** SEO metadata for the item. */
  seo: Maybe<SeoEntry>;
  /** Type classification of the item. */
  type: ItemType;
  /** Unique identifier string for the item. */
  uniqueId: Maybe<Scalars['String']['output']>;
  /** URI identifier for the item. */
  uri: Maybe<Scalars['String']['output']>;
  /** Number of users who have added this item to their wantlist. */
  wants: Maybe<Scalars['Int']['output']>;
};

/** Search results for item labels with pagination information. */
export type ItemLabelsResult = {
  __typename?: 'ItemLabelsResult';
  /** List of labels matching the search criteria. */
  labels: Array<ItemLabelsResultLabel>;
  /** Pagination information for the search results. */
  pagination: Maybe<Pagination>;
};

/** Label entry in item labels search results, containing the label ID and name. */
export type ItemLabelsResultLabel = {
  __typename?: 'ItemLabelsResultLabel';
  /** Numeric label ID. */
  id: Scalars['Long']['output'];
  /** Name of the label. */
  name: Scalars['String']['output'];
};

/** Input fields for creating or updating a listing, including stock, status, pricing, location, and other listing-specific information. */
export type ItemListingInput = {
  /** Date when the listing becomes available for purchase, in ISO 8601 format (YYYY-MM-DD). */
  available: Scalars['String']['input'];
  /** Barcode (UPC, EAN, etc.) for the listing. */
  barcode?: InputMaybe<Scalars['String']['input']>;
  /** List of category names to associate this listing with. */
  categories?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Public comments or notes about the listing, visible to customers. */
  comments?: InputMaybe<Scalars['String']['input']>;
  /** Discogs listing ID if this listing is synchronized with Discogs marketplace. */
  discogsId?: InputMaybe<Scalars['Float']['input']>;
  /** Whether to apply stock automations to this listing. */
  lastCopyAutomation?: InputMaybe<Scalars['Boolean']['input']>;
  /** Location name where the item is stored or available. */
  location?: InputMaybe<Scalars['String']['input']>;
  /** Whether this listing can only be purchased once per customer. */
  onePerCustomer?: InputMaybe<Scalars['Boolean']['input']>;
  /** List of option values for variant listings (e.g., size, color, format). */
  options?: InputMaybe<Array<InputMaybe<ItemListingInputOption>>>;
  /** Date when the listing was posted or published, in ISO 8601 format (YYYY-MM-DD). */
  posted?: InputMaybe<Scalars['String']['input']>;
  /** Whether this listing is available for pre-order (item not yet available but can be ordered). */
  preOrder?: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether to prevent this listing from being automatically listed on Discogs when Discogs sync is enabled. */
  preventDiscogsListing?: InputMaybe<Scalars['Boolean']['input']>;
  /** Pricing information including cost, sale price, and compare-at price. */
  prices?: InputMaybe<ItemListingInputPrices>;
  /** Private comments or notes about the listing, visible only to admins. */
  privateComments?: InputMaybe<Scalars['String']['input']>;
  /** Whether this listing is for a second-hand item. */
  secondHand?: InputMaybe<Scalars['Boolean']['input']>;
  /** Stock keeping unit (SKU) identifier for the listing. */
  sku?: InputMaybe<Scalars['String']['input']>;
  /** Listing status. Valid values include "published" (visible to customers), "draft" (not visible), or "private" (visible only to admins). */
  status: Scalars['String']['input'];
  /** Stock information including quantity available. */
  stock?: InputMaybe<ItemListingInputStock>;
  /** Supplier code associated with this listing. */
  supplierCode?: InputMaybe<Scalars['String']['input']>;
  /** Supplier reference ID. When provided, the supplier name is resolved and dual-written alongside supplierCode. */
  supplierId?: InputMaybe<Scalars['ID']['input']>;
  /** Tax definition identifier to apply to this listing for tax calculation. */
  taxDefinition?: InputMaybe<Scalars['String']['input']>;
};

/** Input fields for listing option values, used to specify variant options for a listing (e.g., size, color). */
export type ItemListingInputOption = {
  /** Name of the option (e.g., "Size", "Color", "Format"). */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Value of the option (e.g., "Large", "Red", "Vinyl"). */
  value?: InputMaybe<Scalars['String']['input']>;
};

/** Input fields for listing pricing information, including cost, sale price, price before taxes, and compare-at price. */
export type ItemListingInputPrices = {
  /** Price before taxes are applied. */
  beforeTaxes?: InputMaybe<Scalars['Float']['input']>;
  /** Compare-at price (original price before discount, used for showing savings). */
  compare?: InputMaybe<Scalars['Float']['input']>;
  /** Cost price of the item (the price paid by the seller). */
  cost?: InputMaybe<Scalars['Float']['input']>;
  /** Sale price of the listing in the shop's currency. */
  sale?: InputMaybe<Scalars['Float']['input']>;
};

/** Input fields for listing stock information, specifying the quantity available. */
export type ItemListingInputStock = {
  /** Stock quantity available for this listing. Null means stock is not tracked (always available). */
  quantity?: InputMaybe<Scalars['Int']['input']>;
};

/** Connection type for paginated customer list results with pagination metadata. Customer lists are used to organize and group buyers for marketing, communications, and customer management purposes. */
export type ItemListsConnection = {
  __typename?: 'ItemListsConnection';
  /** List of customer lists in the current page, sorted by creation date. */
  lists: Array<List>;
  /** Pagination information including page number, total count, and limit. */
  pagination: Maybe<Pagination>;
};

/** Price suggestions and statistics from Discogs marketplace for a release, including current listings, scraped prices, and market statistics. */
export type ItemPriceSuggestions = {
  __typename?: 'ItemPriceSuggestions';
  /** List of current listings from Discogs marketplace with price and condition information. */
  discogsPrices: Array<ItemPriceSuggestionsEntry>;
  /** List of scraped prices from Discogs marketplace (historical or cached data). */
  discogsScrappedPrices: Array<ItemPriceSuggestionsEntry>;
  /** Market statistics from Discogs including collection counts and price statistics. */
  discogsStatistics: ItemDiscogsStatistics;
  /** URL to the release page on Discogs. */
  discogsUrl: Scalars['String']['output'];
};

/** Price suggestion entry from Discogs marketplace, containing price information, condition, and seller details. */
export type ItemPriceSuggestionsEntry = {
  __typename?: 'ItemPriceSuggestionsEntry';
  /** Media condition of the item (e.g., "Mint", "Near Mint", "Very Good", "Good", "Fair", "Poor"). */
  mediaCondition: Scalars['String']['output'];
  /** Additional notes about the listing. */
  notes: Maybe<Scalars['String']['output']>;
  /** Price as a numeric value in the currency's base unit. */
  price: Scalars['Float']['output'];
  /** Price as a formatted string (e.g., "$25.00", "€20.00"). */
  priceString: Scalars['String']['output'];
  /** Seller name or identifier. */
  seller: Maybe<Scalars['String']['output']>;
  /** Country or location where the seller ships from. */
  shipsFrom: Maybe<Scalars['String']['output']>;
  /** Sleeve condition of the item (e.g., "Mint", "Near Mint", "Very Good", "Good", "Fair", "Poor"). */
  sleeveCondition: Scalars['String']['output'];
};

/** Input fields for gift card configuration when creating a product item that generates gift cards. */
export type ItemProductGiftCardInput = {
  /** Whether gift card generation is active for this product. */
  active?: InputMaybe<Scalars['Boolean']['input']>;
  /** Length of the generated gift card code when prefix is not provided. */
  codeLength?: InputMaybe<Scalars['Int']['input']>;
  /** Prefix for the gift card code. If provided, a single gift card is created with this prefix as the ID. */
  prefix?: InputMaybe<Scalars['String']['input']>;
  /**
   * Whether the gift card can only be used once. This field is deprecated; use spendingLimit instead.
   * @deprecated Field no longer supported
   */
  singleSpending?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Input fields for creating or updating a product item, including product information, images, identifiers, and optional gift card configuration. */
export type ItemProductInput = {
  /** Link to an external asset or resource related to the product. */
  assetLink?: InputMaybe<Scalars['String']['input']>;
  /** Catalog number or product code assigned by the manufacturer. */
  cat?: InputMaybe<Scalars['String']['input']>;
  /** Gift card configuration for products that generate gift cards upon purchase. */
  giftCard?: InputMaybe<ItemProductGiftCardInput>;
  /** List of identifiers such as barcodes, SKUs, or catalog numbers. */
  identifiers?: InputMaybe<Array<InputMaybe<ItemIdentifierInput>>>;
  /** List of images associated with the product. */
  images?: InputMaybe<Array<InputMaybe<ItemImageInput>>>;
  /** Manufacturer name of the product. */
  manufacturer?: InputMaybe<Scalars['String']['input']>;
  /** Title of the product. */
  title?: InputMaybe<Scalars['String']['input']>;
  /** Product type or category. */
  type?: InputMaybe<Scalars['String']['input']>;
  /** Weight of the product in grams. */
  weight?: InputMaybe<Scalars['Int']['input']>;
};

/** Input fields for release artist information, used when specifying main artists for a music release. */
export type ItemReleaseArtistInput = {
  /** Artist name variation (ANV) as it appears on the release, if different from the main artist name. */
  anv?: InputMaybe<Scalars['String']['input']>;
  /** Discogs artist ID. This is a Discogs identifier, not an internal database ID. */
  id?: InputMaybe<Scalars['Long']['input']>;
  /** Join string used to combine multiple artist names (e.g., " & ", ", ", " / ", etc.). */
  join?: InputMaybe<Scalars['String']['input']>;
  /** Artist name as it appears on the release. */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Role of the artist on the release (e.g., "Main", "Producer", "Remix", etc.). */
  role?: InputMaybe<Scalars['String']['input']>;
};

/** Input fields for release format information, describing the physical format of a music release. */
export type ItemReleaseFormatInput = {
  /** Array of format descriptions providing additional details about the format(s) of the release (e.g., "LP", "CD", "Cassette", "7"", "12"", etc.). */
  descriptions?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Format name (e.g. "Vinyl", "CD", "Cassette", "SACD", "DVD", "Blu-ray", etc.). */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Quantity of the format (e.g., "2" for a double LP, "1" for a single CD or 12"", etc.). */
  qty?: InputMaybe<Scalars['String']['input']>;
  /** Additional text description for the format. */
  text?: InputMaybe<Scalars['String']['input']>;
};

/** Input fields for creating or updating a music release item, including release metadata, tracklist, formats, and associated artists and labels. */
export type ItemReleaseInput = {
  /** List of main artists associated with the release. */
  artists?: InputMaybe<Array<InputMaybe<ItemReleaseArtistInput>>>;
  /** Link to an external asset or resource related to the release. */
  assetLink?: InputMaybe<Scalars['String']['input']>;
  /** Country code where the release was issued (ISO 3166-1 alpha-2 format, e.g., "US", "GB", "FR"). */
  country?: InputMaybe<Scalars['String']['input']>;
  /** Creators ID. If provided, the release data will be imported from Creators when creating the item. */
  creatorsId?: InputMaybe<Scalars['String']['input']>;
  /** Discogs release ID. If provided, the release data will be imported from Discogs when creating the item. */
  discogsId?: InputMaybe<Scalars['Long']['input']>;
  /** List of physical formats for the release (e.g., vinyl, CD, cassette). */
  formats?: InputMaybe<Array<ItemReleaseFormatInput>>;
  /** List of genre names associated with the release (e.g., "Electronic", "Rock", "Jazz"). */
  genres?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  /** List of identifiers such as barcodes or catalog numbers. */
  identifiers?: InputMaybe<Array<InputMaybe<ItemIdentifierInput>>>;
  /** List of images associated with the release, typically including cover art. */
  images?: InputMaybe<Array<InputMaybe<ItemImageInput>>>;
  /** List of record labels associated with the release. */
  labels?: InputMaybe<Array<InputMaybe<ItemReleaseLabelInput>>>;
  /** Release date of the music release. */
  releaseDate?: InputMaybe<Scalars['Date']['input']>;
  /** List of style names associated with the release (e.g., "House", "Techno", "Ambient"). */
  styles?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  /** Title of the release. */
  title?: InputMaybe<Scalars['String']['input']>;
  /** List of tracks on the release, including title, position, duration, and associated artists. */
  tracklist?: InputMaybe<Array<ItemReleaseTrackInput>>;
  /** List of videos associated with the release. */
  videos?: InputMaybe<Array<InputMaybe<ItemReleaseVideoInput>>>;
  /** Weight of the release in grams. */
  weight?: InputMaybe<Scalars['Int']['input']>;
  /**
   * Release year. This field is deprecated; use releaseDate instead.
   * @deprecated Field no longer supported
   */
  year?: InputMaybe<Scalars['Int']['input']>;
};

/** Input fields for release label information, used when specifying record labels for a music release. */
export type ItemReleaseLabelInput = {
  /** Catalog number assigned by the label for this release. */
  catno?: InputMaybe<Scalars['String']['input']>;
  /** Discogs label ID. This is a Discogs identifier, not an internal database ID. */
  id?: InputMaybe<Scalars['Long']['input']>;
  /** Name of the record label. */
  name?: InputMaybe<Scalars['String']['input']>;
};

/** Input fields for track artist information, used when specifying artists for individual tracks on a release. */
export type ItemReleaseTrackArtistInput = {
  /** Artist name variation (ANV) as it appears on the release, if different from the main artist name. */
  anv?: InputMaybe<Scalars['String']['input']>;
  /** Discogs artist ID. This is a Discogs identifier, not an internal database ID. */
  id?: InputMaybe<Scalars['Long']['input']>;
  /** Artist name as it appears on the release. */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Role of the artist on this track (e.g., "Producer", "Remix", "Featuring", etc.). */
  role?: InputMaybe<Scalars['String']['input']>;
};

/** Input fields for track information on a music release, including title, position, duration, and associated artists. */
export type ItemReleaseTrackInput = {
  /** List of artists associated with this track. */
  artists?: InputMaybe<Array<InputMaybe<ItemReleaseTrackArtistInput>>>;
  /** Duration of the track in the format "MM:SS" or "HH:MM:SS". */
  duration?: InputMaybe<Scalars['String']['input']>;
  /** Position of the track on the release (e.g., "A1", "B2", "1", "2-1", etc.). */
  position?: InputMaybe<Scalars['String']['input']>;
  /** Title of the track. */
  title?: InputMaybe<Scalars['String']['input']>;
  /** Type of track (e.g., "Track", "Index", "Heading", etc.). */
  type_?: InputMaybe<Scalars['String']['input']>;
};

/** Input fields for release video information, used when specifying videos associated with a music release. */
export type ItemReleaseVideoInput = {
  /** Duration of the video in seconds. */
  duration?: InputMaybe<Scalars['Int']['input']>;
  /** Title of the video. */
  title?: InputMaybe<Scalars['String']['input']>;
  /** URI or URL to the video. */
  uri?: InputMaybe<Scalars['String']['input']>;
};

/** Sales statistics for a specific item, showing all orders that include this item with pagination information. */
export type ItemSalesStatistics = {
  __typename?: 'ItemSalesStatistics';
  /** List of orders that include this item in the current page. */
  orders: Array<Order>;
  /** Pagination information including page number, total count, and limit. */
  pagination: Pagination;
};

/** Search results for items with pagination information. */
export type ItemSearchResults = {
  __typename?: 'ItemSearchResults';
  /** List of items matching the search criteria. */
  entries: Array<Item>;
  /** Pagination information for the search results. */
  pagination: Maybe<Pagination>;
};

/** Response after creating an audio snippet, containing the snippet URI and a status message. */
export type ItemSnippetCreateResponse = {
  __typename?: 'ItemSnippetCreateResponse';
  /** Status message describing the result of the snippet creation. */
  message: Scalars['String']['output'];
  /** URI to access the created audio snippet. */
  uri: Scalars['String']['output'];
};

/** Response containing a pre-signed URL for uploading an audio snippet file and the storage key. */
export type ItemSnippetSignedUrlResponse = {
  __typename?: 'ItemSnippetSignedUrlResponse';
  /** Storage key to use when registering the uploaded file with itemSnippetCreate. */
  key: Scalars['String']['output'];
  /** Pre-signed URL for uploading the snippet file to cloud storage. */
  signedUrl: Scalars['String']['output'];
};

/** Aggregated statistics for an item over a given date range. */
export type ItemStatistics = {
  __typename?: 'ItemStatistics';
  /** Newsletter campaigns that featured this item during the period. */
  campaignEvents: Array<StatisticsCampaignEvent>;
  /** Top countries by order count for this item. */
  countrySales: Array<StatisticsCountryPoint>;
  /** Bucket granularity chosen for the series based on the date range. */
  granularity: StatisticsGranularity;
  /** Date of the most recent sale for this item (null if never sold). */
  lastSoldAt: Maybe<Scalars['Date']['output']>;
  /** Total page views in the period. */
  pageViews: Scalars['Int']['output'];
  /** Time series of page views and sales. */
  series: Array<StatisticsDataPoint>;
  /** Total units sold in the period. */
  sold: Scalars['Int']['output'];
  /** Raw stock quantity update events extracted from item logs. */
  stockHistory: Array<StatisticsStockPoint>;
};

/** Results container for item statistics queries, containing a list of statistics entries for multiple items. */
export type ItemStatsForIdsResults = {
  __typename?: 'ItemStatsForIdsResults';
  /** List of statistics entries, one for each requested item ID. */
  entries: Array<ItemStatsForIdsResultsEntry>;
};

/** Statistics entry for a specific item, including audio preview count, listings count, and creation information. */
export type ItemStatsForIdsResultsEntry = {
  __typename?: 'ItemStatsForIdsResultsEntry';
  /** Number of audio previews (snippets) associated with this item. */
  audioPreviewsCount: Maybe<Scalars['Int']['output']>;
  /** Date when the item was created. */
  createdAt: Maybe<Scalars['Date']['output']>;
  /** Reference ID of the admin user who created the item. */
  createdBy: Maybe<Scalars['String']['output']>;
  /** Numeric item ID. */
  id: Maybe<Scalars['Long']['output']>;
  /** Number of listings associated with this item. */
  listingsCount: Maybe<Scalars['Int']['output']>;
};

/** Type classification for inventory items. */
export type ItemType =
  | 'BookItem'
  | 'ProductItem'
  | 'ReleaseItem';

/** Line item representing a single product in an order or checkout. */
export type LineItem = {
  __typename?: 'LineItem';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Date when this item was added to the order or checkout. */
  added: Maybe<Scalars['Date']['output']>;
  /**
   * Single gift card associated with this line item. Use giftCards instead.
   * @deprecated Field no longer supported
   */
  giftCard: Maybe<LineItemGiftCard>;
  /** Gift cards associated with this line item. */
  giftCards: Maybe<Array<LineItemGiftCard>>;
  /** Item information including identifier, description, and metadata. */
  item: LineItemItem;
  /** Listing information at the time of purchase (snapshot). */
  listing: ListingCopy;
  /** Price breakdown for this line item including taxes and discounts. */
  price: LinePrice;
  /** Quantity of items in this line item. */
  quantity: Scalars['Int']['output'];
  /** Whether this item is currently unavailable. */
  unavailable: Maybe<Scalars['Boolean']['output']>;
};

/** Gift card information within a line item. */
export type LineItemGiftCard = {
  __typename?: 'LineItemGiftCard';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Whether the gift card was automatically generated. */
  generated: Maybe<Scalars['Boolean']['output']>;
  /** Gift card identifier code. */
  id: Maybe<Scalars['String']['output']>;
};

/** Item information within a line item, including basic metadata. */
export type LineItemItem = {
  __typename?: 'LineItemItem';
  /** Description of the item. */
  description: Maybe<Scalars['String']['output']>;
  /** Numeric identifier for the item. */
  id: Maybe<Scalars['Float']['output']>;
  /** URL path to the item page. */
  path: Maybe<Scalars['String']['output']>;
  /** Internal database reference to the item. */
  ref: Maybe<Scalars['String']['output']>;
  /** Thumbnail image URL for the item. */
  thumbnail: Maybe<Scalars['String']['output']>;
  /** Type of item (e.g., "ReleaseItem", "ProductItem", "BookItem"). */
  type: Maybe<Scalars['String']['output']>;
  /** Weight of the item in grams or specified unit. */
  weight: Maybe<Scalars['Float']['output']>;
};

/** Price breakdown for a line item including base price, taxes, discounts, and totals. */
export type LinePrice = {
  __typename?: 'LinePrice';
  /** Base price of the item before any adjustments. */
  base: Scalars['Float']['output'];
  /** Price before taxes are applied. */
  beforeTaxes: Scalars['Float']['output'];
  /** Discounts applied to this line item. */
  discounts: Maybe<Array<LinePriceDiscount>>;
  /** Price after discounts are applied. */
  postDiscount: Maybe<Scalars['Float']['output']>;
  /** Subtotal for this line item after discounts and before taxes. */
  subtotal: Maybe<Scalars['Float']['output']>;
  /** Subtotal before taxes are applied. */
  subtotalBeforeTaxes: Maybe<Scalars['Float']['output']>;
  /** Tax amounts broken down by tax definition. */
  taxAmounts: Maybe<Array<Tax>>;
  /** Tax information applied to this line item. */
  taxes: Array<Tax>;
  /** Total price for this line item including all taxes and discounts. */
  total: Maybe<Scalars['Float']['output']>;
};

/** Discount applied to a line item price. */
export type LinePriceDiscount = {
  __typename?: 'LinePriceDiscount';
  /** Type of discount. Valid values include "percentage" or "value". */
  type: Maybe<Scalars['String']['output']>;
  /** Discount value amount. */
  value: Maybe<Scalars['Float']['output']>;
};

/** Represents a customer list for organizing and managing buyers. */
export type List = {
  __typename?: 'List';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Number of buyers currently in the list. */
  count: Maybe<Scalars['Int']['output']>;
  /** Date when the list was created. */
  created: Scalars['Date']['output'];
  /** Description of the list. */
  description: Maybe<Scalars['String']['output']>;
  /** Numeric identifier for the list. */
  id: Scalars['Int']['output'];
  /** Whether this is a system-generated list that cannot be deleted. */
  system: Maybe<Scalars['Boolean']['output']>;
  /** Title of the list. */
  title: Scalars['String']['output'];
};

/** Represents a listing (inventory variant) of an item with pricing, stock, and options. */
export type Listing = {
  __typename?: 'Listing';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Whether the listing is archived. */
  archived: Maybe<Scalars['Boolean']['output']>;
  /** Date when the item becomes available for purchase. */
  available: Maybe<Scalars['Date']['output']>;
  /** Barcode identifier for the item. */
  barcode: Maybe<Scalars['String']['output']>;
  /** Categories this listing belongs to. */
  categories: Array<Scalars['String']['output']>;
  /** Public comments or notes about the listing. */
  comments: Maybe<Scalars['String']['output']>;
  /** User who created the listing. */
  createdBy: Maybe<UserReference>;
  /** External identifier from the marketplace system. */
  discogsId: Maybe<Scalars['Float']['output']>;
  /** Numeric identifier for the listing. */
  id: Scalars['Float']['output'];
  /** Whether to apply stock automations to this listing. */
  lastCopyAutomation: Maybe<Scalars['Boolean']['output']>;
  /** Storage location of the item. */
  location: Maybe<Scalars['String']['output']>;
  /**
   * Historical log entries for the listing.
   * @deprecated Field no longer supported
   */
  logs: Maybe<Array<Maybe<LogEntry>>>;
  /** Whether only one item per customer is allowed for this listing. */
  onePerCustomer: Maybe<Scalars['Boolean']['output']>;
  /** Product option variants for this listing. */
  options: Array<ListingOption>;
  /** Date when the listing was posted or published. */
  posted: Maybe<Scalars['Date']['output']>;
  /** Whether this is a pre-order listing. */
  preOrder: Maybe<Scalars['Boolean']['output']>;
  /** Whether to prevent this listing from being listed on the marketplace system. */
  preventDiscogsListing: Maybe<Scalars['Boolean']['output']>;
  /** Pricing information for the listing. */
  prices: ListingPrice;
  /** Private comments visible only to staff. */
  privateComments: Maybe<Scalars['String']['output']>;
  /** Whether the listing is read-only and cannot be modified. */
  readOnly: Maybe<Scalars['Boolean']['output']>;
  /** Whether this is a second-hand item. */
  secondHand: Maybe<Scalars['Boolean']['output']>;
  /** Stock keeping unit (SKU) identifier. */
  sku: Maybe<Scalars['String']['output']>;
  /** Status of the listing. Valid values include "active", "inactive", "sold", or "archived". */
  status: Scalars['String']['output'];
  /** Stock quantity information. */
  stock: ListingStock;
  /** Supplier reference linking to the suppliers collection. */
  supplier: Maybe<ListingSupplier>;
  /** Supplier code for the item. */
  supplierCode: Maybe<Scalars['String']['output']>;
  /** Tax definition identifier applied to this listing. */
  taxDefinition: Maybe<Scalars['String']['output']>;
};

/** Channel configuration for a listing across different sales channels. */
export type ListingChannels = {
  __typename?: 'ListingChannels';
  /** Bandcamp channel configuration. */
  bandcamp: ListingChannelsBandcamp;
  /** Marketplace system channel configuration. */
  discogs: ListingChannelsDiscogs;
  /** E-shop channel configuration. */
  eshop: ListingChannelsEshop;
  /** Meta channel configuration. */
  meta: ListingChannelsMeta;
  /** Point-of-sale channel configuration. */
  pos: ListingChannelsPos;
};

/** Bandcamp channel configuration for a listing. */
export type ListingChannelsBandcamp = {
  __typename?: 'ListingChannelsBandcamp';
  /** Whether the listing is enabled for Bandcamp channel. */
  enable: Scalars['Boolean']['output'];
};

/** Marketplace system channel configuration for a listing. */
export type ListingChannelsDiscogs = {
  __typename?: 'ListingChannelsDiscogs';
  /** Whether the listing is enabled for the marketplace system channel. */
  enable: Scalars['Boolean']['output'];
};

/** E-shop channel configuration for a listing. */
export type ListingChannelsEshop = {
  __typename?: 'ListingChannelsEshop';
  /** Whether the listing is enabled for e-shop channel. */
  enable: Scalars['Boolean']['output'];
};

/** Meta channel configuration for a listing. */
export type ListingChannelsMeta = {
  __typename?: 'ListingChannelsMeta';
  /** Whether the listing is enabled for Meta channel. */
  enable: Scalars['Boolean']['output'];
};

/** Point-of-sale channel configuration for a listing. */
export type ListingChannelsPos = {
  __typename?: 'ListingChannelsPos';
  /** Whether the listing is enabled for point-of-sale channel. */
  enable: Scalars['Boolean']['output'];
};

/** Copy of listing information used in orders to preserve the state at the time of purchase. */
export type ListingCopy = {
  __typename?: 'ListingCopy';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Whether it was archived at the time of order. */
  archived: Maybe<Scalars['Boolean']['output']>;
  /** Available date at the time of order. */
  available: Maybe<Scalars['Date']['output']>;
  /** Barcode at the time of order. */
  barcode: Maybe<Scalars['String']['output']>;
  /** Categories at the time of order. */
  categories: Array<Scalars['String']['output']>;
  /** Public comments at the time of order. */
  comments: Maybe<Scalars['String']['output']>;
  /** External identifier from the marketplace system at the time of order. */
  discogsId: Maybe<Scalars['Float']['output']>;
  /** Numeric identifier for the listing. */
  id: Scalars['Float']['output'];
  /** Storage location at the time of order. */
  location: Maybe<Scalars['String']['output']>;
  /** Log entries at the time of order. */
  logs: Maybe<Array<Maybe<LogEntry>>>;
  /** Whether one per customer was enforced at the time of order. */
  onePerCustomer: Maybe<Scalars['Boolean']['output']>;
  /** Product options at the time of order. */
  options: Array<ListingOption>;
  /** Posted date at the time of order. */
  posted: Maybe<Scalars['Date']['output']>;
  /** Whether it was a pre-order at the time of order. */
  preOrder: Maybe<Scalars['Boolean']['output']>;
  /** Whether marketplace system listing was prevented at the time of order. */
  preventDiscogsListing: Maybe<Scalars['Boolean']['output']>;
  /** Pricing information at the time of order. */
  prices: ListingPrice;
  /** Private comments at the time of order. */
  privateComments: Maybe<Scalars['String']['output']>;
  /** Whether the listing was read-only at the time of order. */
  readOnly: Maybe<Scalars['Boolean']['output']>;
  /** Whether it was second-hand at the time of order. */
  secondHand: Maybe<Scalars['Boolean']['output']>;
  /** SKU at the time of order. */
  sku: Maybe<Scalars['String']['output']>;
  /** Status of the listing at the time of order. */
  status: Scalars['String']['output'];
  /** Stock quantity at the time of order. */
  stock: ListingStock;
  /** Supplier reference at the time of order. */
  supplier: Maybe<ListingSupplier>;
  /** Supplier code at the time of order. */
  supplierCode: Maybe<Scalars['String']['output']>;
  /** Tax definition identifier at the time of order. */
  taxDefinition: Maybe<Scalars['String']['output']>;
};

/** Product option variant for a listing (e.g., size, color). */
export type ListingOption = {
  __typename?: 'ListingOption';
  /** Name of the option (e.g., "Size", "Color"). */
  name: Maybe<Scalars['String']['output']>;
  /** Value of the option (e.g., "Large", "Red"). */
  value: Maybe<Scalars['String']['output']>;
};

export type ListingPrice = {
  __typename?: 'ListingPrice';
  /** Price before taxes are applied. */
  beforeTaxes: Maybe<Scalars['Float']['output']>;
  /** Original price for comparison (strikethrough price). */
  compare: Maybe<Scalars['Float']['output']>;
  /** Cost price of the item. */
  cost: Maybe<Scalars['Float']['output']>;
  /** Current sale price. */
  sale: Maybe<Scalars['Float']['output']>;
};

/** Stock quantity information for a listing. */
export type ListingStock = {
  __typename?: 'ListingStock';
  /** Available quantity in stock. Null means stock is not tracked (always available). */
  quantity: Maybe<Scalars['Long']['output']>;
};

/** Pricing information for a listing. */
export type ListingSupplier = {
  __typename?: 'ListingSupplier';
  /** Short unique identifier of the supplier (nanoid). */
  id: Scalars['String']['output'];
  /** Supplier name at the time of assignment. */
  name: Scalars['String']['output'];
  /** Reference ID of the supplier document. */
  ref: Scalars['ID']['output'];
};

/** Log entry tracking an action or event with user and timestamp information. */
export type LogEntry = {
  __typename?: 'LogEntry';
  /** Type of action that was performed. */
  action: Maybe<Scalars['String']['output']>;
  /** Date when the action occurred. */
  date: Maybe<Scalars['Date']['output']>;
  /** Description of the action or event. */
  description: Maybe<Scalars['String']['output']>;
  /** IP address from which the action was performed. */
  ip: Maybe<Scalars['String']['output']>;
  /** User who performed the action. */
  user: Maybe<UserReference>;
};

/** Represents a media file with metadata and multiple format variants. */
export type Media = {
  __typename?: 'Media';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Alternative text for accessibility and SEO. */
  alt: Maybe<Scalars['String']['output']>;
  /** Caption or description text for the media. */
  caption: Maybe<Scalars['String']['output']>;
  /** Creation information including user and date. */
  created: Maybe<MediaCreated>;
  /** File extension of the original media file. */
  ext: Maybe<Scalars['String']['output']>;
  /** Folder or directory path where the media is stored. */
  folder: Maybe<Scalars['String']['output']>;
  /** Array of all available format variants for this media file. */
  formatArray: Array<MediaFormat>;
  /** Height of the original media in pixels. */
  height: Maybe<Scalars['Int']['output']>;
  /** Numeric identifier for the media item. */
  id: Scalars['Int']['output'];
  /** Storage key or identifier for the original media file. */
  key: Maybe<Scalars['String']['output']>;
  /** MIME type of the media file (e.g., "image/jpeg", "image/png", "application/pdf"). */
  mime: Maybe<Scalars['String']['output']>;
  /** Modification information including user and date. */
  modified: Maybe<MediaModified>;
  /** File size in bytes. */
  size: Maybe<Scalars['Int']['output']>;
  /** Title of the media file. */
  title: Maybe<Scalars['String']['output']>;
  /** URL to access the original media file. */
  url: Maybe<Scalars['String']['output']>;
  /** Width of the original media in pixels. */
  width: Maybe<Scalars['Int']['output']>;
};

/** Connection type for paginated media results with pagination metadata. */
export type MediaConnection = {
  __typename?: 'MediaConnection';
  /** List of media items in the current page, sorted by creation date. */
  media: Array<Media>;
  /** Pagination information including page number, total count, and limit. */
  pagination: Pagination;
};

/** Creation information for a media file. */
export type MediaCreated = {
  __typename?: 'MediaCreated';
  /** User who created the media file. */
  by: Maybe<UserReference>;
  /** Date when the media file was created. */
  date: Maybe<Scalars['Date']['output']>;
};

/** A specific format variant of a media file with dimensions and URL. */
export type MediaFormat = {
  __typename?: 'MediaFormat';
  /** File extension for this format variant. */
  ext: Maybe<Scalars['String']['output']>;
  /** Height of the media in pixels. */
  height: Maybe<Scalars['Int']['output']>;
  /** Storage key or identifier for the format variant. */
  key: Maybe<Scalars['String']['output']>;
  /** MIME type of the format variant. */
  mime: Maybe<Scalars['String']['output']>;
  /** Name of the format variant (e.g., "thumbnail", "banner", "large"). */
  name: Maybe<Scalars['String']['output']>;
  /** File size in bytes. */
  size: Maybe<Scalars['Int']['output']>;
  /** URL to access the formatted media file. */
  url: Maybe<Scalars['String']['output']>;
  /** Width of the media in pixels. */
  width: Maybe<Scalars['Int']['output']>;
};

/** Modification information for a media file. */
export type MediaModified = {
  __typename?: 'MediaModified';
  /** User who last modified the media file. */
  by: Maybe<UserReference>;
  /** Date when the media file was last modified. */
  date: Maybe<Scalars['Date']['output']>;
};

/** Input fields for updating media metadata including title, alt text, and caption. */
export type MediaUpdateInput = {
  /** Alternative text for the media item, used for accessibility and SEO. */
  alt?: InputMaybe<Scalars['String']['input']>;
  /** Caption or description text for the media item. */
  caption?: InputMaybe<Scalars['String']['input']>;
  /** Title or name of the media item. */
  title?: InputMaybe<Scalars['String']['input']>;
};

/** Represents a message in an order conversation thread or general messaging system. */
export type Message = {
  __typename?: 'Message';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Attachments included with the message. */
  attachments: Array<MessageAttachment>;
  /** Formatted message content (HTML or processed text). */
  content: Scalars['String']['output'];
  /** Date when the message was created. */
  created: Scalars['Date']['output'];
  /** Whether the message has been flagged for attention. */
  flagged: Scalars['Boolean']['output'];
  /** Whether the message was sent by the buyer. */
  fromBuyer: Maybe<Scalars['Boolean']['output']>;
  /** Message content text. */
  message: Scalars['String']['output'];
  /** Order identifier string associated with this message. */
  orderId: Maybe<Scalars['String']['output']>;
  /** Incremental numeric identifier of the order associated with this message. */
  orderIncId: Maybe<Scalars['Int']['output']>;
  /** Whether the message has been read. */
  read: Maybe<Scalars['Boolean']['output']>;
  /** Sender information for the message. */
  sender: Maybe<MessageSender>;
  /** Subject line of the message. */
  subject: Maybe<Scalars['String']['output']>;
  /** URI identifier for the message. */
  uri: Maybe<Scalars['String']['output']>;
  /** Channel or method through which the message was sent (e.g., "email", "web", "api"). */
  via: Maybe<Scalars['String']['output']>;
};

/** Attachment associated with a message. */
export type MessageAttachment = {
  __typename?: 'MessageAttachment';
  /** Internal database identifier. */
  _id: Maybe<Scalars['ID']['output']>;
  /** Title or filename of the attachment. */
  title: Maybe<Scalars['String']['output']>;
  /** URI to access the attachment file. */
  uri: Maybe<Scalars['String']['output']>;
};

/** Sender information for a message. */
export type MessageSender = {
  __typename?: 'MessageSender';
  /** Alias or display name of the sender. */
  alias: Maybe<Scalars['String']['output']>;
  /** Email address of the sender. */
  email: Maybe<Scalars['String']['output']>;
  /** Name of the message sender. */
  name: Maybe<Scalars['String']['output']>;
  /** Internal database reference to the sender user. */
  ref: Maybe<Scalars['ID']['output']>;
};

/** Connection type for paginated message results with pagination metadata. */
export type MessagesConnection = {
  __typename?: 'MessagesConnection';
  /** List of messages in the current page, sorted by timestamp. */
  messages: Array<Message>;
  /** Pagination information including page number, total count, and limit. */
  pagination: Pagination;
};

export type Mutation = {
  __typename?: 'Mutation';
  /** Creates a new collection with the specified title and optional reference. */
  collectionCreate: Collection;
  /** Deletes a collection by its reference ID. */
  collectionDelete: Maybe<Scalars['String']['output']>;
  /** Updates the SEO metadata for a collection. */
  collectionSeoUpdate: Collection;
  /** Updates an existing collection's details, including title, sorting, view type, segments, banner, and description. */
  collectionUpdate: Collection;
  /** Publishes an inventory item to the shared feed (max 6 per hour per shop). */
  feedCreatePost: Maybe<FeedPost>;
  /** Toggles a feed post as a favorite for the given user. */
  feedSavePost: Maybe<FeedPost>;
  /** Creates a new supplier with the specified name. */
  inventorySupplierCreate: Supplier;
  /** Creates a reporting relationship for a supplier, allowing the supplier to access reporting features. */
  inventorySupplierCreateReporting: Supplier;
  /** Deletes a supplier. This operation cannot be undone. */
  inventorySupplierDelete: Maybe<Scalars['String']['output']>;
  /** Deletes a reporting relationship for a supplier. */
  inventorySupplierDeleteReporting: Supplier;
  /** Updates an existing supplier's information, including tax information, addresses, and contacts. */
  inventorySupplierUpdate: Supplier;
  /** Uploads an audio snippet for a release. */
  itemAudioUpload: ItemAudioUploadResponse;
  /** Creates a new item of the specified type (BookItem, ReleaseItem, or ProductItem) with optional descriptions and listings. For ReleaseItem with a discogsId, the release data will be imported from Discogs if the method parameter is provided. */
  itemCreate: Item;
  /** Deletes an item and all its associated listings. This operation cannot be undone. */
  itemDelete: Scalars['String']['output'];
  /** Generates a short link for an item, returning the item and the generated URI. */
  itemGenerateLink: Maybe<ItemGenerateLinkResult>;
  /** Registers an uploaded image for an item after it has been uploaded using the signed URL from itemImageSignedUrl. */
  itemImageRegister: Item;
  /** Generates a pre-signed URL for uploading an item image to cloud storage. The image must be registered after upload using itemImageRegister. */
  itemImageSignedUrl: ItemImageSignedUrlResponse;
  /** Adds a new listing to an existing item. The listing must include stock quantity, status, available date, and pricing information. */
  itemListingAdd: Item;
  /** Deletes a listing from an item. The item must have at least one listing remaining. */
  itemListingDelete: Item;
  /** Lists or unlists a listing on Discogs. If list is true, the listing will be created on Discogs (if Discogs sync is enabled and the listing meets requirements). If unlist is true, the listing will be removed from Discogs. */
  itemListingDiscogs: Item;
  /** Updates an existing listing's fields. Only the provided fields will be updated. Prices are automatically adjusted based on the store's tax configuration. */
  itemListingUpdate: Item;
  /** Updates SEO settings for an item, including title, description, index flag, and slug. */
  itemSeoUpdate: Item;
  /**
   * Creates an audio snippet for a release after uploading the file. This mutation is deprecated.
   * @deprecated Field no longer supported
   */
  itemSnippetCreate: ItemSnippetCreateResponse;
  /**
   * Generates a pre-signed URL for uploading an audio snippet file for a release. This mutation is deprecated.
   * @deprecated Field no longer supported
   */
  itemSnippetSignedUrlGenerate: ItemSnippetSignedUrlResponse;
  /** Generates stickers for specified listings using a template. Returns a URI to download the generated stickers file. */
  itemStickersGenerate: Maybe<Scalars['String']['output']>;
  /** Updates an existing item's descriptions and type-specific data. Only the provided fields will be updated. */
  itemUpdate: Item;
  /** Updates an item's data from Discogs, fetching the latest release information for ReleaseItem types with a discogsId. */
  itemUpdateFromDiscogs: Item;
  /**
   * Adds buyers to a customer list. If listRef is provided, buyers are added to that existing list.
   * If listTitle is provided and listRef is not, a new customer list is created with that title and buyers are added to it.
   * If neither listRef nor listTitle is provided, an error is returned. The list member count is automatically updated after adding buyers.
   */
  listAddBuyers: List;
  /** Adds buyers to an existing customer list. Buyers are added to the list if they are not already members. The list member count is automatically updated after adding buyers. */
  listAddUsers: Maybe<List>;
  /** Creates a new customer list with the specified title. Customer lists are used to organize buyers into groups for marketing, communications, and customer management purposes. */
  listCreate: Maybe<List>;
  /** Deletes a customer list and removes all buyer associations with that list. All buyers are automatically removed from the list when it is deleted. This operation cannot be undone. */
  listDelete: Maybe<Scalars['String']['output']>;
  /** Updates the title of an existing customer list. */
  listEdit: List;
  /** Removes buyers from a customer list. Buyers who have opted out are not removed. The list member count is automatically updated after removing buyers. */
  listRemoveUsers: Maybe<List>;
  /** Creates a new media item by uploading a file. For image files (excluding SVG), multiple size variants are automatically generated and stored. The file is uploaded to cloud storage and metadata is extracted. */
  mediaCreate: Maybe<Media>;
  /** Deletes one or more media items and their associated files from cloud storage. This operation cannot be undone. */
  mediaDelete: Maybe<Scalars['String']['output']>;
  /** Updates metadata for a media item, including title, alt text, and caption. */
  mediaUpdate: Maybe<Media>;
  /** Archives a message by deleting it. This operation cannot be undone. */
  messageArchive: Scalars['String']['output'];
  /** Creates a new message associated with an order. Optionally includes file attachments. For non-Discogs orders, attachments are uploaded to cloud storage and email notifications are sent to the buyer. For Discogs orders, messages are sent through the Discogs API. */
  messageCreate: Message;
  /** Flags a message, typically used to mark it as important or requiring attention. */
  messageFlag: Message;
  /** Marks a message as read for the current user. */
  messageMarkAsRead: Message;
  /** Adds a discount or credit note to an order. */
  orderAddDiscount: Order;
  /** Adds an inventory listing as a new line item on an order. */
  orderAddItem: Order;
  /** Adds a note to an order. The note is added to the order's log and visible in the order history. */
  orderAddNote: Order;
  /** Adds a payment method to an order. The payment amount is added to the order's payment methods. If markAsPaid is true and the order status is "New Order" or "Invoice Sent", the order status is updated to "Payment Received". For marketplace orders, the status may also be synchronized with the marketplace. */
  orderAddPaymentMethod: Order;
  /** Adds a refund method to an order. The refund amount is recorded in the order's payment methods. Refunds reduce the total paid amount for the order. */
  orderAddRefundMethod: Order;
  /** Applies a voucher to an order. */
  orderAddVoucher: Order;
  /** Updates the billing information for an order, including billing address and invoice ID. */
  orderBillingUpdate: Order;
  /**
   * Cancels an order, optionally relisting stock, recording a note, a refund status and a
   * Discogs cancellation reason for marketplace orders.
   */
  orderCancel: Order;
  /** Marks an order as shipped or packed. If isPacked is true, the order is marked as packed. Otherwise, the order status is updated to "Shipped" and the shipping date is set. For marketplace orders, the status may also be synchronized with the marketplace. Optionally sends a shipping confirmation email to the buyer. */
  orderCarrierBuyLabel: Order;
  /** Updates the buyer associated with an order. Changes the buyer reference for the order. */
  orderEditBuyer: Order;
  /**
   * Generates a gift card for a specific order line item. This mutation is deprecated in favor of orderGenerateGiftCards which generates gift cards for all applicable line items in an order.
   * @deprecated Field no longer supported
   */
  orderGenerateGiftCard: Maybe<Order>;
  /** Generates gift cards for all applicable line items in an order. Gift cards are created for line items that are configured to generate gift cards and are sent via email to the buyer. */
  orderGenerateGiftCards: Order;
  /** Generates a packing slip PDF for an order. The packing slip is used for shipping and includes order items and shipping information. */
  orderGeneratePackingSlip: Order;
  /** Generates a PDF invoice for an order and updates the order with the generated PDF URL. The PDF is stored and can be accessed via the order's invoice PDF field. */
  orderGeneratePdf: Order;
  /** Marks an order line item as unavailable. This is used when an item in an order cannot be fulfilled. Returns the updated order and a message describing the result. */
  orderLineMarkAsUnavailable: OrderUpdateWithMessage;
  /** Marks an order as shipped or packed. If isPacked is true, the order is marked as packed. Otherwise, the order status is updated to "Shipped" and the shipping date is set. For marketplace orders, the status may also be synchronized with the marketplace. Optionally sends a shipping confirmation email to the buyer. */
  orderMarkAsShipped: Order;
  /** Merges a source order into a target order. The source order's items are added to the target order, and the source order is marked as merged. Only orders with status "New Order", without vouchers, and without credit note payments can be merged. */
  orderMerge: Order;
  /** Removes a discount from an order. */
  orderRemoveDiscount: Order;
  /** Removes a payment method from an order. You can specify either the payment method reference ID or the payment method origin. If both are provided, the reference ID takes precedence. */
  orderRemovePaymentMethod: Order;
  /** Removes a refund method from an order. You can specify either the refund method reference ID or the refund method origin. If both are provided, the reference ID takes precedence. */
  orderRemoveRefundMethod: Order;
  /** Removes the voucher applied to an order. */
  orderRemoveVoucher: Order;
  /** Generates a PDF report from HTML content. Used for creating sales reports and other order-related PDF documents. Only accessible to admin users. */
  orderReportPdf: Scalars['String']['output'];
  /** Sends a PDF report via email. The PDF URL should be generated using orderReportPdf. Only accessible to admin users. */
  orderReportSend: Scalars['String']['output'];
  /** Sends an invoice email to the buyer. The email includes the invoice PDF and uses the provided subject and message. Optionally sends a copy to the current user. */
  orderSendInvoice: Order;
  /** Sends an invoice email to the buyer and optionally creates a buyer account if one doesn't exist. If createAccount is true and no buyer account exists for the email, a new account is created. Returns information about the order, buyer, and account creation status. */
  orderSendInvoiceWithAccountCreation: OrderSendInvoiceResult;
  /** Updates the shipping information for an order, including shipping price and shipping address. You can provide either a new address input, an existing address reference, or update only the shipping price. */
  orderShippingUpdate: Order;
  /** Updates a single line item on an order (price, quantity, taxes, etc.). */
  orderUpdateLine: Order;
  /** Updates the status of an order (e.g. locking it by moving it to "Invoice Sent"). */
  orderUpdateStatus: Order;
  /** Updates only the tracking link for an order. This does not change shipping status/date and does not trigger shipping confirmation side effects. */
  orderUpdateTrackingLink: Order;
  /** Creates a new playlist with the specified title. The playlist is created with an empty entries array and assigned a numeric ID. Returns the newly created playlist. */
  playlistCreate: Maybe<Playlist>;
  /** Deletes a playlist by its reference ID. Returns a success message upon deletion. */
  playlistDelete: Maybe<Scalars['String']['output']>;
  /** Updates an existing playlist. You can update the title, link, and entries. When updating entries, the entire entries array is replaced with the provided entries. Only the fields provided in the input are updated; other fields remain unchanged. */
  playlistUpdate: Maybe<Playlist>;
  /** Creates a new buyer with personal information, contact details, addresses, and optional list memberships. If createEshopAccount is true, the buyer is created with an eshop account and a password token is generated. If lists are provided, the buyer is added to those customer lists. Returns the created buyer. */
  userBuyerCreate: Maybe<Buyer>;
  /** Creates an eshop account for an existing buyer who doesn't have one. Generates a password token and sends an account creation confirmation email. The buyer must not already have an account created. */
  userBuyerCreateEshopAccount: Maybe<Buyer>;
  /** Generates a password reset token for a buyer and initiates the password reset process. The token is sent via the client API. Returns the buyer. */
  userBuyerCreatePasswordToken: Maybe<Buyer>;
  /** Deletes a buyer by anonymizing their data. The buyer's personal information is removed, email is anonymized, and the buyer is marked as inactive. Associated sessions, checkouts, and wants are also deleted. The buyer is removed from all customer lists. Returns the anonymized buyer. */
  userBuyerDelete: Maybe<Buyer>;
  /** Updates a buyer's customer list memberships. Replaces the buyer's current list memberships with the provided list references. Buyers are removed from lists not included in the new list references, and added to new lists. */
  userBuyerListsUpdate: Buyer;
  /** Updates a buyer's information. You can update email, personal details, contact information, addresses, list memberships, notes, and birthdate. Only the fields provided in the input are updated; other fields remain unchanged. Email must be unique if changed. */
  userBuyerUpdate: Buyer;
  /**
   * Creates a new buyer with the specified email. This mutation is deprecated in favor of userBuyerCreate which provides more control over buyer creation.
   * @deprecated Field no longer supported
   */
  userCreate: Maybe<BuyerCreateResponse>;
  /** Sends an email verification message to a buyer. If the buyer doesn't have a verification token, one is generated. The buyer must verify their email address to complete account setup. */
  userVerify: Maybe<Scalars['String']['output']>;
  /**
   * Exports buyers to a CSV file. If listRef or term is provided, only matching buyers are exported.
   * Otherwise, all buyers and guest buyers from orders are exported. The CSV includes buyer information, addresses, order statistics, and account status.
   * Only accessible to admin users. Returns a signed URL to download the CSV file.
   */
  usersExport: Maybe<Scalars['String']['output']>;
  /** Creates one or more vouchers. If a prefix is provided, a single voucher is created with that prefix as the ID. If no prefix is provided, a voucher code is generated. For gift cards, the ID cannot be manually specified. Returns an array of created vouchers. */
  voucherCreate: Array<Voucher>;
  /** Deactivates a voucher by marking it as redeemed. The voucher cannot be used after deactivation. Only non-redeemed vouchers can be deactivated. Returns the updated voucher. */
  voucherDeactivate: Maybe<Voucher>;
  /** Deletes a voucher by its reference ID. Only non-redeemed vouchers can be deleted. Returns a success message upon deletion. */
  voucherDelete: Maybe<Scalars['String']['output']>;
  /** Updates the note on a voucher. Replaces any existing note with the new note content. */
  voucherNoteUpdate: Voucher;
  /** Sends a voucher receipt email with PDF attachment to the specified recipient. Generates a PDF for the voucher if one doesn't exist. The email includes the voucher details and can be used for gift cards or coupons. Only works for non-redeemed vouchers. */
  voucherSendReceipt: Voucher;
};


export type MutationCollectionCreateArgs = {
  collectionRef: InputMaybe<Scalars['ID']['input']>;
  title: Scalars['String']['input'];
};


export type MutationCollectionDeleteArgs = {
  collectionRef: Scalars['ID']['input'];
};


export type MutationCollectionSeoUpdateArgs = {
  collectionRef: Scalars['ID']['input'];
  seoInput: SeoInput;
};


export type MutationCollectionUpdateArgs = {
  bannerFormat: InputMaybe<Scalars['String']['input']>;
  bannerRef: InputMaybe<Scalars['ID']['input']>;
  description: InputMaybe<Scalars['String']['input']>;
  ref: Scalars['ID']['input'];
  segments: Scalars['JSON']['input'];
  sort: InputMaybe<CollectionSortInput>;
  title: Scalars['String']['input'];
  viewType: InputMaybe<Scalars['String']['input']>;
};


export type MutationFeedCreatePostArgs = {
  configRef: Scalars['ID']['input'];
  item: FeedItemInput;
};


export type MutationFeedSavePostArgs = {
  postRef: Scalars['ID']['input'];
  userRef: Scalars['ID']['input'];
};


export type MutationInventorySupplierCreateArgs = {
  name: Scalars['String']['input'];
};


export type MutationInventorySupplierCreateReportingArgs = {
  supplierRef: Scalars['ID']['input'];
};


export type MutationInventorySupplierDeleteArgs = {
  supplierRef: Scalars['ID']['input'];
};


export type MutationInventorySupplierDeleteReportingArgs = {
  reportingRef: Scalars['ID']['input'];
  supplierRef: Scalars['ID']['input'];
};


export type MutationInventorySupplierUpdateArgs = {
  supplierRef: Scalars['ID']['input'];
  supplierUpdateInput: SupplierUpdateInput;
};


export type MutationItemAudioUploadArgs = {
  itemRef: Scalars['ID']['input'];
  registerAudioInput: InputMaybe<RegisterAudioInput>;
  signedUrlInput: InputMaybe<SignedUrlInput>;
};


export type MutationItemCreateArgs = {
  descriptions: InputMaybe<ItemInputDescriptions>;
  itemCreateBookInput: InputMaybe<ItemBookInput>;
  itemCreateProductInput: InputMaybe<ItemProductInput>;
  itemCreateReleaseInput: InputMaybe<ItemReleaseInput>;
  listings: InputMaybe<Array<InputMaybe<ItemListingInput>>>;
  method: InputMaybe<Scalars['String']['input']>;
  type: Scalars['String']['input'];
};


export type MutationItemDeleteArgs = {
  itemRef: Scalars['ID']['input'];
};


export type MutationItemGenerateLinkArgs = {
  itemRef: Scalars['ID']['input'];
  type: InputMaybe<Scalars['String']['input']>;
};


export type MutationItemImageRegisterArgs = {
  alternative: Scalars['Boolean']['input'];
  filename: Scalars['String']['input'];
  index: InputMaybe<Scalars['Int']['input']>;
  itemRef: Scalars['ID']['input'];
  key: Scalars['String']['input'];
};


export type MutationItemImageSignedUrlArgs = {
  filename: Scalars['String']['input'];
  itemRef: Scalars['ID']['input'];
};


export type MutationItemListingAddArgs = {
  itemListingInput: ItemListingInput;
  itemRef: Scalars['ID']['input'];
};


export type MutationItemListingDeleteArgs = {
  listingRef: Scalars['ID']['input'];
};


export type MutationItemListingDiscogsArgs = {
  list: InputMaybe<Scalars['Boolean']['input']>;
  listingRef: Scalars['ID']['input'];
  unlist: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationItemListingUpdateArgs = {
  itemListingInput: ItemListingInput;
  listingRef: Scalars['ID']['input'];
};


export type MutationItemSeoUpdateArgs = {
  itemRef: Scalars['ID']['input'];
  seoInput: SeoInput;
};


export type MutationItemSnippetCreateArgs = {
  filename: Scalars['String']['input'];
  key: Scalars['String']['input'];
  position: Scalars['String']['input'];
  releaseId: Scalars['Long']['input'];
};


export type MutationItemSnippetSignedUrlGenerateArgs = {
  filename: Scalars['String']['input'];
  releaseId: Scalars['Long']['input'];
};


export type MutationItemStickersGenerateArgs = {
  fields: InputMaybe<Scalars['JSON']['input']>;
  listingRefs: Array<InputMaybe<Scalars['ID']['input']>>;
  templateRef: Scalars['ID']['input'];
};


export type MutationItemUpdateArgs = {
  descriptions: InputMaybe<ItemInputDescriptions>;
  itemRef: Scalars['ID']['input'];
  itemUpdateBookInput: InputMaybe<ItemBookInput>;
  itemUpdateProductInput: InputMaybe<ItemProductInput>;
  itemUpdateReleaseInput: InputMaybe<ItemReleaseInput>;
};


export type MutationItemUpdateFromDiscogsArgs = {
  itemRef: Scalars['ID']['input'];
};


export type MutationListAddBuyersArgs = {
  listRef: InputMaybe<Scalars['ID']['input']>;
  listTitle: InputMaybe<Scalars['String']['input']>;
  userRefs: Array<Scalars['ID']['input']>;
};


export type MutationListAddUsersArgs = {
  listRef: Scalars['ID']['input'];
  userRefs: Array<Scalars['ID']['input']>;
};


export type MutationListCreateArgs = {
  title: Scalars['String']['input'];
};


export type MutationListDeleteArgs = {
  listRef: Scalars['ID']['input'];
};


export type MutationListEditArgs = {
  listRef: Scalars['ID']['input'];
  title: Scalars['String']['input'];
};


export type MutationListRemoveUsersArgs = {
  listRef: Scalars['ID']['input'];
  userRefs: Array<Scalars['ID']['input']>;
};


export type MutationMediaCreateArgs = {
  file: Scalars['Upload']['input'];
};


export type MutationMediaDeleteArgs = {
  mediaRefs: Array<InputMaybe<Scalars['ID']['input']>>;
};


export type MutationMediaUpdateArgs = {
  mediaRef: Scalars['ID']['input'];
  mediaUpdateInput: MediaUpdateInput;
};


export type MutationMessageArchiveArgs = {
  messageRef: Scalars['ID']['input'];
};


export type MutationMessageCreateArgs = {
  files: InputMaybe<Array<InputMaybe<Scalars['Upload']['input']>>>;
  message: Scalars['String']['input'];
  orderRef: Scalars['ID']['input'];
};


export type MutationMessageFlagArgs = {
  messageRef: Scalars['ID']['input'];
};


export type MutationMessageMarkAsReadArgs = {
  messageRef: Scalars['ID']['input'];
};


export type MutationOrderAddDiscountArgs = {
  amount: InputMaybe<Scalars['Float']['input']>;
  creditNoteRef: InputMaybe<Scalars['ID']['input']>;
  orderRef: Scalars['ID']['input'];
  type: Scalars['String']['input'];
  value: InputMaybe<Scalars['Float']['input']>;
};


export type MutationOrderAddItemArgs = {
  listingRef: Scalars['ID']['input'];
  orderId: Scalars['String']['input'];
};


export type MutationOrderAddNoteArgs = {
  orderAddNoteInput: InputMaybe<Scalars['String']['input']>;
  orderRef: Scalars['ID']['input'];
};


export type MutationOrderAddPaymentMethodArgs = {
  markAsPaid: InputMaybe<Scalars['Boolean']['input']>;
  orderPaymentMethodInput: OrderPaymentMethodInput;
  orderRef: Scalars['ID']['input'];
};


export type MutationOrderAddRefundMethodArgs = {
  orderPaymentMethodInput: OrderPaymentMethodInput;
  orderRef: Scalars['ID']['input'];
};


export type MutationOrderAddVoucherArgs = {
  orderRef: Scalars['ID']['input'];
  voucherRef: Scalars['ID']['input'];
};


export type MutationOrderBillingUpdateArgs = {
  billingAddress: InputMaybe<AddressInput>;
  buyerRef: InputMaybe<Scalars['ID']['input']>;
  invoiceId: InputMaybe<Scalars['String']['input']>;
  orderRef: Scalars['ID']['input'];
};


export type MutationOrderCancelArgs = {
  discogsReason: InputMaybe<Scalars['String']['input']>;
  note: InputMaybe<Scalars['String']['input']>;
  orderRef: Scalars['ID']['input'];
  refundStatus: InputMaybe<Scalars['String']['input']>;
  relist: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationOrderCarrierBuyLabelArgs = {
  carrier: InputMaybe<Scalars['String']['input']>;
  contractId: InputMaybe<Scalars['Int']['input']>;
  method: InputMaybe<Scalars['String']['input']>;
  orderRef: Scalars['ID']['input'];
  rateId: Scalars['String']['input'];
};


export type MutationOrderEditBuyerArgs = {
  buyerRef: InputMaybe<Scalars['ID']['input']>;
  orderRef: Scalars['ID']['input'];
};


export type MutationOrderGenerateGiftCardArgs = {
  lineRef: Scalars['ID']['input'];
  orderRef: Scalars['ID']['input'];
};


export type MutationOrderGenerateGiftCardsArgs = {
  orderRef: Scalars['ID']['input'];
};


export type MutationOrderGeneratePackingSlipArgs = {
  format: InputMaybe<Scalars['String']['input']>;
  orderRef: Scalars['ID']['input'];
};


export type MutationOrderGeneratePdfArgs = {
  orderRef: Scalars['ID']['input'];
};


export type MutationOrderLineMarkAsUnavailableArgs = {
  orderLineRef: Scalars['ID']['input'];
  orderRef: Scalars['ID']['input'];
};


export type MutationOrderMarkAsShippedArgs = {
  email: InputMaybe<Scalars['String']['input']>;
  isPacked: InputMaybe<Scalars['Boolean']['input']>;
  orderRef: Scalars['ID']['input'];
  trackingLink: InputMaybe<Scalars['String']['input']>;
};


export type MutationOrderMergeArgs = {
  orderRef: Scalars['ID']['input'];
  orderSourceRef: Scalars['ID']['input'];
};


export type MutationOrderRemoveDiscountArgs = {
  discountRef: InputMaybe<Scalars['ID']['input']>;
  orderRef: Scalars['ID']['input'];
  type: Scalars['String']['input'];
};


export type MutationOrderRemovePaymentMethodArgs = {
  orderPaymentMethodOrigin: InputMaybe<Scalars['String']['input']>;
  orderPaymentMethodRef: InputMaybe<Scalars['ID']['input']>;
  orderRef: Scalars['ID']['input'];
};


export type MutationOrderRemoveRefundMethodArgs = {
  orderPaymentMethodOrigin: InputMaybe<Scalars['String']['input']>;
  orderPaymentMethodRef: InputMaybe<Scalars['ID']['input']>;
  orderRef: Scalars['ID']['input'];
};


export type MutationOrderRemoveVoucherArgs = {
  orderRef: Scalars['ID']['input'];
};


export type MutationOrderReportPdfArgs = {
  html: Scalars['String']['input'];
  title: Scalars['String']['input'];
};


export type MutationOrderReportSendArgs = {
  cc: InputMaybe<Scalars['String']['input']>;
  email: Scalars['String']['input'];
  message: Scalars['String']['input'];
  pdfUrl: Scalars['String']['input'];
  subject: Scalars['String']['input'];
};


export type MutationOrderSendInvoiceArgs = {
  orderInvoiceInput: OrderInvoiceInput;
  orderRef: Scalars['ID']['input'];
};


export type MutationOrderSendInvoiceWithAccountCreationArgs = {
  createAccount: InputMaybe<Scalars['Boolean']['input']>;
  orderInvoiceInput: OrderInvoiceInput;
  orderRef: Scalars['ID']['input'];
};


export type MutationOrderShippingUpdateArgs = {
  orderRef: Scalars['ID']['input'];
  orderShippingAddressInput: InputMaybe<AddressInput>;
  orderShippingAddressRef: InputMaybe<Scalars['ID']['input']>;
  orderShippingPriceInput: InputMaybe<PriceInput>;
};


export type MutationOrderUpdateLineArgs = {
  line: Scalars['JSON']['input'];
  orderId: Scalars['String']['input'];
};


export type MutationOrderUpdateStatusArgs = {
  orderRef: Scalars['ID']['input'];
  status: Scalars['String']['input'];
};


export type MutationOrderUpdateTrackingLinkArgs = {
  orderRef: Scalars['ID']['input'];
  trackingLink: InputMaybe<Scalars['String']['input']>;
};


export type MutationPlaylistCreateArgs = {
  title: InputMaybe<Scalars['String']['input']>;
};


export type MutationPlaylistDeleteArgs = {
  playlistRef: Scalars['ID']['input'];
};


export type MutationPlaylistUpdateArgs = {
  playlistRef: Scalars['ID']['input'];
  playlistUpdateInput: InputMaybe<PlaylistUpdateInput>;
};


export type MutationUserBuyerCreateArgs = {
  addresses: InputMaybe<Array<InputMaybe<AddressInput>>>;
  createEshopAccount: InputMaybe<Scalars['Boolean']['input']>;
  email: Scalars['String']['input'];
  firstName: Scalars['String']['input'];
  lastName: Scalars['String']['input'];
  lists: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  organisation: InputMaybe<Scalars['String']['input']>;
  taxNumber: InputMaybe<Scalars['String']['input']>;
  telephone: InputMaybe<Scalars['String']['input']>;
};


export type MutationUserBuyerCreateEshopAccountArgs = {
  userRef: Scalars['ID']['input'];
};


export type MutationUserBuyerCreatePasswordTokenArgs = {
  email: Scalars['String']['input'];
};


export type MutationUserBuyerDeleteArgs = {
  userRef: Scalars['ID']['input'];
};


export type MutationUserBuyerListsUpdateArgs = {
  listRefs: Array<Scalars['ID']['input']>;
  userRef: Scalars['ID']['input'];
};


export type MutationUserBuyerUpdateArgs = {
  userBuyerUpdateInput: UserBuyerUpdateInput;
  userRef: Scalars['ID']['input'];
};


export type MutationUserCreateArgs = {
  createEshopAccount: InputMaybe<Scalars['Boolean']['input']>;
  email: Scalars['String']['input'];
};


export type MutationUserVerifyArgs = {
  userRef: Scalars['ID']['input'];
};


export type MutationUsersExportArgs = {
  listRef: InputMaybe<Scalars['ID']['input']>;
  term: InputMaybe<Scalars['String']['input']>;
};


export type MutationVoucherCreateArgs = {
  amount: Scalars['Int']['input'];
  codeLength: InputMaybe<Scalars['Int']['input']>;
  expires: InputMaybe<Scalars['Date']['input']>;
  id: InputMaybe<Scalars['String']['input']>;
  note: InputMaybe<Scalars['String']['input']>;
  prefix: InputMaybe<Scalars['String']['input']>;
  redeemType: Scalars['String']['input'];
  singleSpending: InputMaybe<Scalars['Boolean']['input']>;
  spendingLimit: InputMaybe<Scalars['Int']['input']>;
  startDate: InputMaybe<Scalars['Date']['input']>;
  type: InputMaybe<Scalars['String']['input']>;
  unlimited: InputMaybe<Scalars['Boolean']['input']>;
  userRef: InputMaybe<Scalars['ID']['input']>;
  value: InputMaybe<Scalars['Float']['input']>;
};


export type MutationVoucherDeactivateArgs = {
  voucherRef: Scalars['ID']['input'];
};


export type MutationVoucherDeleteArgs = {
  voucherRef: Scalars['ID']['input'];
};


export type MutationVoucherNoteUpdateArgs = {
  note: Scalars['String']['input'];
  voucherRef: Scalars['ID']['input'];
};


export type MutationVoucherSendReceiptArgs = {
  recipient: InputMaybe<Scalars['String']['input']>;
  voucherRef: Scalars['ID']['input'];
};

/** Note or comment added to an order, checkout, or other resource. */
export type Note = {
  __typename?: 'Note';
  /** Content of the note. */
  content: Maybe<Scalars['String']['output']>;
  /** Date when the note was created. */
  date: Maybe<Scalars['Date']['output']>;
  /** User who created the note. */
  user: Maybe<UserReference>;
};

/** Represents a customer order with items, billing, shipping, and payment information. */
export type Order = {
  __typename?: 'Order';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Billing information including payment methods, status, and invoice details. */
  billing: Billing;
  /** Buyer information for the order. */
  buyer: Maybe<CheckoutOrOrderBuyer>;
  /** Whether the buyer has been contacted regarding this order. */
  buyerWasContacted: Maybe<Scalars['Boolean']['output']>;
  /** Date when the order was created. */
  created: Scalars['Date']['output'];
  /** Status specific to orders from the marketplace system. Used when origin is "Discogs". */
  discogsStatus: Maybe<Scalars['String']['output']>;
  /** Order identifier string (e.g., "123456-789012"). */
  id: Scalars['String']['output'];
  /** Incremental numeric identifier assigned to the order. */
  incId: Scalars['Int']['output'];
  /** Special instructions for processing or shipping the order. */
  instructions: Maybe<Scalars['String']['output']>;
  /** Line items included in the order. */
  items: Array<LineItem>;
  /** Historical log entries tracking changes and actions on the order. */
  logs: Array<LogEntry>;
  /** List of orders that can be merged with this order. */
  mergeableOrders: Maybe<Array<OrderMergeable>>;
  /** Messages in the order conversation thread between buyer and seller. */
  messages: Maybe<Array<Message>>;
  /** Date when the order was last modified. */
  modified: Scalars['Date']['output'];
  /** Notes and comments added to the order. */
  notes: Array<Note>;
  /**
   * Legacy order identifier. Use the id field instead.
   * @deprecated Field no longer supported
   */
  orderId: Maybe<Scalars['String']['output']>;
  /** Origin of the order. Valid values include "Shop" (point-of-sale), "Online" (storefront), "Discogs" (marketplace), or "Bandcamp" (marketplace). */
  origin: Scalars['String']['output'];
  /** URL path to the order page. */
  path: Maybe<Scalars['String']['output']>;
  /** Seller or staff member who processed the order. */
  seller: Maybe<UserReference>;
  /** Shipping information including address, method, status, and tracking. */
  shipping: Shipping;
  /** Current status of the order. Valid values include "New Order", "Buyer Contacted", "Invoice Sent", "Payment Pending", "Payment Received", "Shipped", "Refund Sent", "Cancelled (Non-Paying Buyer)", "Cancelled (Item Unavailable)", "Cancelled (Per Buyer's Request)", "Merged", or "Quote". */
  status: Scalars['String']['output'];
  /** Financial totals including subtotals, taxes, shipping, discounts, and grand total. */
  totals: Totals;
  /** Number of unread messages in the order conversation thread. */
  unreadMessagesCount: Maybe<Scalars['Int']['output']>;
  /** Date when the order was last updated (synonym for modified). */
  updated: Maybe<Scalars['Date']['output']>;
};

/** A live carrier rate option for fulfilling an order (Sendcloud/Shippo). */
export type OrderCarrierRate = {
  __typename?: 'OrderCarrierRate';
  /** Carrier name (e.g. "PostNL", "Colissimo"). */
  carrier: Maybe<Scalars['String']['output']>;
  /** Sendcloud contract identifier required when buying the label. */
  contractId: Maybe<Scalars['Int']['output']>;
  /** ISO 4217 currency of the price. */
  currency: Maybe<Scalars['String']['output']>;
  /** Estimated delivery time in days. */
  estimatedDays: Maybe<Scalars['Int']['output']>;
  /** Aggregator the quote came from. Valid values are "sendcloud" or "shippo". */
  provider: Maybe<Scalars['String']['output']>;
  /** Provider rate identifier — pass back to buy the label. */
  rateId: Scalars['String']['output'];
  /** Service level name shown to the merchant. */
  service: Maybe<Scalars['String']['output']>;
  /** Price including the handling surcharge. */
  total: Scalars['Float']['output'];
};

/** Input fields for sending an invoice email to a buyer. Used when sending invoices via email with optional CC to the sender. */
export type OrderInvoiceInput = {
  /** Whether to send a copy of the email to the current user. */
  ccMe: Scalars['Boolean']['input'];
  /** Email message body to include with the invoice. */
  message: Scalars['String']['input'];
  /** Email address of the invoice recipient. */
  recipient: Scalars['String']['input'];
  /** Email subject line for the invoice email. */
  subject: Scalars['String']['input'];
};

/** Represents an order that can be merged with another order. */
export type OrderMergeable = {
  __typename?: 'OrderMergeable';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Date when the order was created. */
  created: Scalars['Date']['output'];
  /** Description or summary of the order for display purposes. */
  description: Scalars['String']['output'];
  /** Order identifier string. */
  id: Scalars['String']['output'];
  /** Grand total amount of the order. */
  total: Scalars['Float']['output'];
};

/** Input fields for adding a payment or refund method to an order. The origin specifies the payment method type, and the amount is the payment or refund value. */
export type OrderPaymentMethodInput = {
  /** Date when the payment was added. Defaults to the current date if not specified. */
  added?: InputMaybe<Scalars['Date']['input']>;
  /** Payment or refund amount in the shop's currency. */
  amount: Scalars['Float']['input'];
  /** Payment method origin. Valid values include "cash", "card", "stripe", "paypal", "cheque", "bankTransfer", or "creditNote". */
  origin: Scalars['String']['input'];
  /** Optional reference ID for the payment method (e.g., transaction ID, payment reference). */
  ref?: InputMaybe<Scalars['ID']['input']>;
};

/** Result type for sending an invoice with account creation, including the order, buyer information, and account creation status. */
export type OrderSendInvoiceResult = {
  __typename?: 'OrderSendInvoiceResult';
  /** Status indicating whether a buyer account was created, matched, or not created during the invoice sending process. */
  accountStatus: Maybe<AccountCreatedStatus>;
  /** The buyer associated with the order. May be null if no buyer is linked. */
  buyer: Maybe<Buyer>;
  /** The order for which the invoice was sent. */
  order: Order;
};

/** Status of order shipping fulfillment. */
export type OrderShippingStatus =
  | 'Collected'
  | 'Packed'
  | 'Pending'
  | 'Shipped';

/** Result type for order update operations that return both the updated order and a message describing the operation result. */
export type OrderUpdateWithMessage = {
  __typename?: 'OrderUpdateWithMessage';
  /** Message describing the result of the operation (e.g., success message, warning, or error information). */
  message: Scalars['String']['output'];
  /** The updated order object. */
  order: Order;
};

/** Connection type for paginated order results with pagination metadata. */
export type OrdersConnection = {
  __typename?: 'OrdersConnection';
  /** List of orders in the current page. */
  orders: Array<Order>;
  /** Pagination information including page number, total count, and limit. */
  pagination: Maybe<Pagination>;
  /**
   * Order statistics including total revenue. This field is deprecated and no longer supported.
   * @deprecated Field no longer supported
   */
  stats: Maybe<OrdersStats>;
};

/** Input fields for filtering and paginating orders. Supports filtering by date range, origin, status, billing status, shipping status, payment methods, and search terms. Used by the orders, ordersStatistics, and ordersReport queries. */
export type OrdersFiltersInput = {
  /** List of billing statuses to filter by. Valid values include "Pending", "Paid", "Partially Paid", "Refunded", or "Partially Refunded". */
  billingStatus?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Reference ID of a specific buyer to filter orders by buyer. */
  buyerRef?: InputMaybe<Scalars['ID']['input']>;
  /** Reference ID of a specific coupon/voucher to filter orders that used this coupon. */
  couponRef?: InputMaybe<Scalars['ID']['input']>;
  /** Date field to use for filtering when from or to are specified. Valid values include "created" (default), "billing.paymentDate", or other order date fields. */
  dateFilter?: InputMaybe<Scalars['String']['input']>;
  /** Start date for filtering orders. Used with the dateFilter field to specify which date field to filter by. */
  from?: InputMaybe<Scalars['Date']['input']>;
  /** Reference ID of a specific gift card to filter orders that used this gift card as payment. */
  giftCardRef?: InputMaybe<Scalars['ID']['input']>;
  /** Reference ID of a specific item to filter orders that contain this item. */
  itemRef?: InputMaybe<Scalars['ID']['input']>;
  /** Number of orders per page. You can request a specific page size, and it will be used if it does not exceed the server-enforced maximum. If your requested size exceeds the maximum, the server will enforce the maximum limit. */
  limit?: InputMaybe<Scalars['Int']['input']>;
  /** Sort order: 1 for ascending, -1 for descending. */
  order?: InputMaybe<Scalars['Int']['input']>;
  /** List of order origins to filter by. Valid values include "Online", "Shop", "Discogs", or "Bandcamp". */
  origin?: InputMaybe<Array<Scalars['String']['input']>>;
  /** The requested page number. Defaults to 1 if not specified. */
  page?: InputMaybe<Scalars['Int']['input']>;
  /** List of payment methods to filter by. Valid values include "cash", "card", "stripe", "paypal", "cheque", "bankTransfer", or "creditNote". */
  paymentMethods?: InputMaybe<Array<Scalars['String']['input']>>;
  /** List of shipping statuses to filter by. Valid values include "Pending", "Shipped", "Collected", or "Packed". */
  shippingStatus?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Field name to sort results by. Valid values include "createdDate" (sorts by creation date), "paymentDate" (sorts by payment date), or "total" (sorts by grand total). Defaults to "createdDate" if not specified. */
  sort?: InputMaybe<Scalars['String']['input']>;
  /**
   * List of order statuses to filter by. Valid values include "New Order", "Buyer Contacted", "Invoice Sent", "Payment Pending",
   * "Payment Received", "Shipped", "Refund Sent", "Cancelled", "Cancelled (Non-Paying Buyer)", "Cancelled (Item Unavailable)",
   * "Cancelled (Per Buyer's Request)", "Merged", or "Quote". If not specified, excludes cancelled, refunded, and merged orders.
   */
  status?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Search term to filter orders by. If the term matches the pattern "number-number", it searches by exact order ID. Otherwise, it performs a case-insensitive search on order descriptions and related fields. */
  term?: InputMaybe<Scalars['String']['input']>;
  /** End date for filtering orders. Used with the dateFilter field to specify which date field to filter by. */
  to?: InputMaybe<Scalars['Date']['input']>;
};

/** Comprehensive sales report containing financial totals, payment method statistics, and item breakdowns. Used for generating sales analytics and reports. */
export type OrdersReport = {
  __typename?: 'OrdersReport';
  /** Item statistics showing counts and revenue by item category. */
  items: OrdersReportItems;
  /** Payment method statistics showing revenue and count per payment method. */
  paymentMethods: Array<OrdersReportPaymentMethod>;
  /** Financial totals including grand total, subtotals, taxes, shipping, and revenue by origin. */
  totals: OrdersReportTotals;
};

/** Item statistics for sales reports, showing counts and revenue by item category. */
export type OrdersReportItems = {
  __typename?: 'OrdersReportItems';
  /** Total revenue from books. */
  books: Scalars['Float']['output'];
  /** Total number of items sold. */
  count: Scalars['Int']['output'];
  /** Total revenue from gift cards. */
  giftCards: Scalars['Float']['output'];
  /** Total revenue from new items. */
  news: Scalars['Float']['output'];
  /** Total revenue from products. */
  products: Scalars['Float']['output'];
  /** Total revenue from second-hand items. */
  secondHands: Scalars['Float']['output'];
};

/** Revenue breakdown by order origin for sales reports, showing totals for each sales channel. */
export type OrdersReportOrigins = {
  __typename?: 'OrdersReportOrigins';
  /** Total revenue from Bandcamp marketplace orders. */
  bandcamp: Scalars['Float']['output'];
  /** Total revenue from Discogs marketplace orders. */
  discogs: Scalars['Float']['output'];
  /** Total revenue from online storefront orders. */
  online: Scalars['Float']['output'];
  /** Total revenue from point-of-sale (POS) orders. */
  pos: Scalars['Float']['output'];
};

/** Payment method statistics for sales reports, showing total revenue and count per payment method. */
export type OrdersReportPaymentMethod = {
  __typename?: 'OrdersReportPaymentMethod';
  /** Number of orders using this payment method. */
  count: Scalars['Int']['output'];
  /** Payment method origin (e.g., "cash", "card", "stripe", "paypal", "cheque", "bankTransfer", "creditNote"). */
  origin: Scalars['String']['output'];
  /** Total revenue amount for this payment method. */
  total: Scalars['Float']['output'];
};

/** Tax statistics for sales reports, showing total tax amount per tax definition. */
export type OrdersReportTax = {
  __typename?: 'OrdersReportTax';
  /** Tax definition identifier or name. */
  id: Scalars['String']['output'];
  /** Total tax amount collected for this tax definition. */
  total: Scalars['Float']['output'];
};

/** Financial totals for sales reports, including grand total, subtotals, taxes, shipping, and profit breakdowns. */
export type OrdersReportTotals = {
  __typename?: 'OrdersReportTotals';
  /** Grand total revenue including all taxes and shipping. */
  grand: Scalars['Float']['output'];
  /** Revenue breakdown by order origin. */
  origins: OrdersReportOrigins;
  /** Profit from second-hand items sold. */
  secondHandProfit: Scalars['Float']['output'];
  /** Shipping costs before taxes. */
  shippingBeforeTaxes: Scalars['Float']['output'];
  /** Subtotal before taxes and shipping. */
  subtotal: Scalars['Float']['output'];
  /** Subtotal before taxes are applied. */
  subtotalBeforeTaxes: Scalars['Float']['output'];
  /** List of tax totals grouped by tax definition. */
  taxes: Array<OrdersReportTax>;
};

/** Statistics for filtered orders, including total revenue and order count. Used for displaying aggregate order metrics. */
export type OrdersStatistics = {
  __typename?: 'OrdersStatistics';
  /** Total number of orders matching the filters. */
  count: Maybe<Scalars['Int']['output']>;
  /** Total revenue amount for the filtered orders. */
  total: Maybe<Scalars['Float']['output']>;
};

/** Statistics for orders, including total revenue. This type is deprecated and only used in the deprecated stats field of OrdersConnection. */
export type OrdersStats = {
  __typename?: 'OrdersStats';
  /** Total revenue amount for the filtered orders. */
  total: Maybe<Scalars['Float']['output']>;
};

/** Pagination metadata providing information about the current page, total count, and available pages. */
export type Pagination = {
  __typename?: 'Pagination';
  /** Total number of items across all pages. */
  count: Maybe<Scalars['Int']['output']>;
  /** Whether there are more pages available beyond the current page. */
  hasMore: Maybe<Scalars['Boolean']['output']>;
  /** Number of items per page in the current result set. */
  limit: Maybe<Scalars['Int']['output']>;
  /** Current page number (1-based). */
  page: Scalars['Int']['output'];
  /** Total number of pages available. */
  pages: Scalars['Int']['output'];
};

/** Input fields for specifying pagination parameters including page number, limit, and sorting options. */
export type PaginationInput = {
  /**
   * Number of items per page. You can request a specific page size, and it will be used if it does not exceed the server-enforced maximum.
   * If your requested size exceeds the maximum, the server will enforce the maximum limit.
   */
  limit?: InputMaybe<Scalars['Int']['input']>;
  /** Sort order: 1 for ascending, -1 for descending. */
  order?: InputMaybe<Scalars['Int']['input']>;
  /** The requested page number. Defaults to 1 if not specified. */
  page?: InputMaybe<Scalars['Int']['input']>;
  /** Field name to sort results by. */
  sort?: InputMaybe<Scalars['String']['input']>;
};

/** Payment method used for a transaction, including amount, origin, and status. */
export type PaymentMethod = {
  __typename?: 'PaymentMethod';
  /** Internal database identifier. */
  _id: Maybe<Scalars['ID']['output']>;
  /** Date when the payment was added. */
  added: Maybe<Scalars['Date']['output']>;
  /** Payment amount in the shop's currency. */
  amount: Scalars['Float']['output'];
  /** Payment processing details in JSON format (e.g., Stripe charge object). */
  charge: Maybe<Scalars['JSON']['output']>;
  /** Display label for the payment method. */
  label: Maybe<Scalars['String']['output']>;
  /** Payment method origin. Valid values include "cash", "card", "stripe", "paypal", "cheque", "bankTransfer", or "creditNote". */
  origin: Maybe<Scalars['String']['output']>;
  /** Reference ID for the payment (e.g., transaction ID, payment reference). */
  ref: Maybe<Scalars['ID']['output']>;
  /** Status of the payment. Valid values include "pending", "completed", "failed", or "refunded". */
  status: Maybe<Scalars['String']['output']>;
};

/** Represents a curated playlist of items. */
export type Playlist = {
  __typename?: 'Playlist';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Date when the playlist was created. */
  created: Maybe<Scalars['Date']['output']>;
  /** Playlist entries with items and optional comments. */
  entries: Array<PlaylistEntry>;
  /** Numeric identifier for the playlist. */
  id: Maybe<Scalars['Int']['output']>;
  /** Optional URL link for the playlist. If provided, the playlist title becomes a clickable link. */
  link: Maybe<Scalars['String']['output']>;
  /** Title of the playlist. */
  title: Maybe<Scalars['String']['output']>;
};

/** A single item entry within a playlist with optional comments. */
export type PlaylistEntry = {
  __typename?: 'PlaylistEntry';
  /** Optional comments or notes about this item in the playlist. */
  comments: Maybe<Scalars['String']['output']>;
  /** The item in the playlist. */
  item: Item;
};

/** Input fields for updating a playlist, including title, optional link, and entries. When updating entries, the entire entries array is replaced with the provided entries. */
export type PlaylistUpdateInput = {
  /** List of playlist entries to replace the existing entries. Each entry contains an item reference and optional comments. If not provided, entries remain unchanged. */
  entries?: InputMaybe<Array<InputMaybe<PlaylistUpdateInputEntry>>>;
  /** Optional link URL for the playlist. If provided, the playlist title becomes a clickable link pointing to this URL. */
  link?: InputMaybe<Scalars['String']['input']>;
  /** Title of the playlist. */
  title?: InputMaybe<Scalars['String']['input']>;
};

/** Input fields for a single playlist entry, representing an item in a playlist with optional comments. */
export type PlaylistUpdateInputEntry = {
  /** Optional comments or notes about this item in the playlist. */
  comments?: InputMaybe<Scalars['String']['input']>;
  /** Reference ID of the item to include in the playlist. */
  ref: Scalars['ID']['input'];
};

/** Connection type for paginated playlist results with pagination metadata. */
export type PlaylistsConnection = {
  __typename?: 'PlaylistsConnection';
  /** Pagination information including page number, total count, and limit. */
  pagination: Pagination;
  /** List of playlists in the current page, sorted by numeric ID in descending order. */
  playlists: Array<Playlist>;
};

/** Specifies pricing details for an item, including base price, pre-tax price, and applicable taxes. */
export type PriceInput = {
  /** Base price of the item before any adjustments or taxes. */
  base?: InputMaybe<Scalars['Float']['input']>;
  /** Price of the item before taxes are applied. */
  beforeTaxes?: InputMaybe<Scalars['Float']['input']>;
  /** List of taxes applied to the item. */
  taxes?: InputMaybe<Array<InputMaybe<TaxInput>>>;
};

/** Gift card configuration for product items. */
export type ProductGiftCard = {
  __typename?: 'ProductGiftCard';
  /** Whether gift card generation is active for this product. */
  active: Maybe<Scalars['Boolean']['output']>;
  /** Length of the gift card code to generate. */
  codeLength: Maybe<Scalars['Int']['output']>;
  /** Whether to automatically generate a voucher when the product is sold. */
  generateVoucherOnSale: Maybe<Scalars['Boolean']['output']>;
  /** Prefix to add to generated gift card codes. */
  prefix: Maybe<Scalars['String']['output']>;
  /** Whether the gift card can only be used once. */
  singleSpending: Maybe<Scalars['Boolean']['output']>;
};

/** Represents a product item with product-specific data. */
export type ProductItem = ItemInterface & {
  __typename?: 'ProductItem';
  _id: Scalars['ID']['output'];
  bitly: Maybe<Scalars['String']['output']>;
  created: Maybe<Scalars['Date']['output']>;
  creatorsId: Maybe<Scalars['String']['output']>;
  /** Product-specific data and metadata. */
  data: ProductItemData;
  descriptions: ItemDescriptions;
  /** @deprecated Field no longer supported */
  handle: Maybe<Scalars['String']['output']>;
  id: Scalars['Float']['output'];
  incId: Maybe<Scalars['Float']['output']>;
  isForbiddenForSale: Maybe<Scalars['Boolean']['output']>;
  listings: Array<Listing>;
  /** @deprecated Field no longer supported */
  logs: Maybe<Array<Maybe<LogEntry>>>;
  modified: Maybe<Scalars['Date']['output']>;
  oldId: Maybe<Scalars['Float']['output']>;
  path: Scalars['String']['output'];
  seo: Maybe<SeoEntry>;
  type: ItemType;
  uniqueId: Maybe<Scalars['String']['output']>;
  uri: Maybe<Scalars['String']['output']>;
  wants: Maybe<Scalars['Int']['output']>;
};

/** Detailed data and metadata specific to product items. */
export type ProductItemData = {
  __typename?: 'ProductItemData';
  /** Category classification for the product. */
  cat: Maybe<Scalars['String']['output']>;
  /** Gift card configuration if this product generates gift cards. */
  giftCard: Maybe<ProductGiftCard>;
  /** Images associated with the product. */
  images: Array<ReleaseImage>;
  /** Manufacturer name of the product. */
  manufacturer: Maybe<Scalars['String']['output']>;
  /** Title of the product. */
  title: Maybe<Scalars['String']['output']>;
  /** Product type classification. */
  type: Maybe<Scalars['String']['output']>;
};

export type Query = {
  __typename?: 'Query';
  /** Returns aggregated page view statistics for an article. */
  articleStatistics: Maybe<ArticleStatistics>;
  /** Fetches a single collection by its unique integer identifier. */
  collection: Maybe<Collection>;
  /**
   * Retrieves paginated items from a collection segment.
   * @deprecated Use inventoryItems instead
   */
  collectionData: Maybe<CollectionData>;
  /** Retrieves paginated items for a collection by its numeric ID. */
  collectionItems: Maybe<CollectionItems>;
  /** Retrieves a paginated list of collections. */
  collectionsConnection: CollectionsConnection;
  /** Retrieves configuration information for a shop or store. */
  config: Maybe<Config>;
  /** Retrieves a paginated page of inventory listings from Discogs that are synced with the local inventory. */
  discogsInventory: Maybe<DiscogsInventoryPage>;
  /** Retrieves a single Discogs inventory listing by its listing ID. */
  discogsListing: Maybe<DiscogsInventoryEntry>;
  /** Retrieves a paginated page of orders from Discogs. */
  discogsOrders: Maybe<DiscogsOrdersPage>;
  /** Searches the Discogs database for releases matching the search term. */
  discogsSearch: Maybe<DiscogsSearchResults>;
  /** Returns the feed grouped into hourly intervals. Pass favorites: true to restrict to the user's saved posts. */
  feedGetIntervals: Array<FeedInterval>;
  /** Returns a single feed post for the given user (resolving its favorite state). */
  feedGetPost: Maybe<FeedPost>;
  /** Retrieves a paginated list of inventory items with comprehensive filtering options. Supports filtering by stock, status, type, location, categories, dates, and more. Results can be sorted by various fields. For filtering, use the filters parameter with InventoryFilters input type. */
  inventory: Maybe<Inventory>;
  /** Estimates the processing time for bulk operations on multiple inventory listings. */
  inventoryBulkEstimate: Maybe<InventoryBulkEstimate>;
  /** Exports sticker data for specified listings to a CSV file. Returns a URI to download the exported file. */
  inventoryExportStickers: Maybe<InventoryExportStickersResponse>;
  /** Retrieves a paginated list of inventory location names, with optional search filtering. */
  inventoryLocations: Maybe<InventoryLocations>;
  /** Retrieves metadata and statistics for inventory items based on filter criteria, including pagination, categories, supplier codes, locations, and aggregate statistics. */
  inventoryMetadata: Maybe<InventoryMetadata>;
  /** Retrieves a paginated list of suppliers associated with inventory items, with optional search filtering. */
  inventorySuppliers: Maybe<InventorySuppliers>;
  /** Retrieves a single item by ID, listing reference, or item reference. Can search by numeric item ID, listing reference ID, or item reference ID. */
  item: Maybe<Item>;
  /** Searches for item artists by term with pagination. Artists are associated with release items and are identified by Discogs artist IDs. */
  itemArtists: ItemArtistsResult;
  /** Searches for books using external book databases (Google Books and ISBNdb) by search term. */
  itemBookSearch: Maybe<ItemBookSearchResults>;
  /** Retrieves item data from the Creators database by Discogs ID or Creators ID, without creating a local item record. */
  itemFromDatabase: Maybe<Item>;
  /** Searches for item labels by term with pagination. Labels are typically used to categorize or tag items. */
  itemLabels: ItemLabelsResult;
  /** Retrieves price suggestions and statistics from Discogs marketplace for a release item, including current listings, scraped prices, and market statistics. */
  itemPriceSuggestions: Maybe<ItemPriceSuggestions>;
  /** Retrieves sales statistics for a specific item, showing all orders that include this item with pagination. */
  itemSalesStatistics: Maybe<ItemSalesStatistics>;
  /** Searches for items by term, matching against title, description, barcode, SKU, identifiers, item ID, Discogs ID, or listing ID. Results are sorted by relevance and can be filtered by type and stock availability. */
  itemSearch: Maybe<ItemSearchResults>;
  /** Returns aggregated page view and sales statistics for an item. */
  itemStatistics: Maybe<ItemStatistics>;
  /** Retrieves statistics for multiple items identified by their IDs, including audio preview count, listings count, and creation information. */
  itemStatsForIds: Maybe<ItemStatsForIdsResults>;
  /** Retrieves multiple items by their IDs or reference IDs. */
  items: Maybe<Array<Item>>;
  /** Retrieves a single customer list by its reference ID. Customer lists are used to organize and group buyers for marketing and communication purposes. */
  list: Maybe<List>;
  /** Retrieves all customer lists associated with the current shop configuration. Results are sorted by creation date. Lists are used to organize buyers into groups for marketing, communications, and customer management. */
  lists: ItemListsConnection;
  /**
   * Retrieves a paginated list of media items with optional filtering by reference ID, numeric ID, file extensions, or multiple IDs.
   * Results are sorted by creation date. You can request a specific page size, and it will be used if it does not exceed the server-enforced maximum.
   * If your requested size exceeds the maximum, the server will enforce the maximum limit.
   */
  media: Maybe<MediaConnection>;
  /** Retrieves a single message by its reference ID. */
  message: Maybe<Message>;
  /**
   * Retrieves a paginated list of messages with optional filtering by order reference and sender type.
   * Results are sorted by timestamp. For marketplace orders, messages may be retrieved from the marketplace system.
   * Page size limits are enforced by the server; you can request a specific page size, and it will be used if it does not exceed the server-enforced maximum.
   * If your requested size exceeds the maximum, the server will enforce the maximum limit.
   */
  messages: MessagesConnection;
  /** Retrieves a single order by numeric ID or reference ID. Can search by order ID (e.g., "123-2024") or order reference (ObjectId). */
  order: Maybe<Order>;
  /** Fetches live carrier rates for an order from the connected aggregator (Sendcloud/Shippo), used at fulfilment time to pick a service and buy a label. */
  orderCarrierRates: Array<OrderCarrierRate>;
  /** Searches for orders by search term. Performs a case-insensitive search on order descriptions and related fields. Returns a list of matching orders. */
  orderSearch: Array<Maybe<Order>>;
  /** Retrieves a paginated list of orders with comprehensive filtering and sorting options. Supports filtering by date range, origin, status, billing status, shipping status, payment methods, items, buyers, coupons, gift cards, and search terms. */
  orders: OrdersConnection;
  /**
   * Retrieves a paginated list of orders with filtering and sorting options. This query is deprecated in favor of the orders query which uses OrdersFiltersInput for a more structured approach.
   * @deprecated Field no longer supported
   */
  ordersConnection: Maybe<OrdersConnection>;
  /** Generates a comprehensive sales report for filtered orders, including financial totals, payment method statistics, and item breakdowns. The report excludes cancelled, refunded, and merged orders. Only accessible to admin users. */
  ordersReport: OrdersReport;
  /** Retrieves aggregate statistics for filtered orders, including total revenue and order count. Only accessible to admin users. */
  ordersStatistics: OrdersStatistics;
  /** Retrieves a single playlist by its numeric ID. Returns the playlist with all entries populated, including item details and comments. */
  playlist: Maybe<Playlist>;
  /** Retrieves a paginated list of playlists. Results are sorted by numeric ID in descending order. Page size is fixed by the server. */
  playlists: Maybe<PlaylistsConnection>;
  /** Retrieves a single buyer by reference ID. Returns the buyer with statistics including order count, order total, credit notes count, wants count, and vouchers count. */
  user: Maybe<Buyer>;
  /** Searches for buyers by search term. Performs a case-insensitive search on email, first name, last name, telephone, and search field. Returns up to 92 matching buyers. If the search term is less than 2 characters, returns all buyers. */
  userSearch: Array<Buyer>;
  /** Retrieves a paginated list of items from a buyer's wantlist. A wantlist is a collection of items the buyer has marked as wanted. Results are sorted by creation date. Page size is fixed by the server. */
  userWantlist: Inventory;
  /** Retrieves a paginated list of buyers with optional filtering by customer list and search term. You can request a specific page size, and it will be used if it does not exceed the server-enforced maximum. If your requested size exceeds the maximum, the server will enforce the maximum limit. */
  users: UsersConnection;
  /**
   * Retrieves a paginated list of vouchers with comprehensive filtering and sorting options.
   * Supports filtering by status, expiration, type, user, voucher ID, and search terms.
   * You can request a specific page size, and it will be used if it does not exceed the server-enforced maximum.
   * If your requested size exceeds the maximum, the server will enforce the maximum limit.
   */
  vouchers: VouchersConnection;
};


export type QueryArticleStatisticsArgs = {
  articleRef: Scalars['ID']['input'];
  from: InputMaybe<Scalars['Date']['input']>;
  granularity: InputMaybe<StatisticsGranularity>;
  to: InputMaybe<Scalars['Date']['input']>;
};


export type QueryCollectionArgs = {
  id: Scalars['Int']['input'];
};


export type QueryCollectionDataArgs = {
  limit: InputMaybe<Scalars['Int']['input']>;
  order: InputMaybe<Scalars['Int']['input']>;
  page: InputMaybe<Scalars['Int']['input']>;
  randomise: InputMaybe<Scalars['Boolean']['input']>;
  segment: Scalars['JSON']['input'];
  sort: InputMaybe<Scalars['String']['input']>;
};


export type QueryCollectionItemsArgs = {
  filters: InputMaybe<Scalars['JSON']['input']>;
  id: InputMaybe<Scalars['Int']['input']>;
  pagination: PaginationInput;
  randomise: Scalars['Boolean']['input'];
};


export type QueryCollectionsConnectionArgs = {
  page: InputMaybe<Scalars['Int']['input']>;
  perPage: InputMaybe<Scalars['Int']['input']>;
  sort: InputMaybe<CollectionSortInput>;
  term: InputMaybe<Scalars['String']['input']>;
};


export type QueryConfigArgs = {
  configRef: InputMaybe<Scalars['ID']['input']>;
  origin: InputMaybe<Scalars['String']['input']>;
};


export type QueryDiscogsInventoryArgs = {
  page: Scalars['Int']['input'];
};


export type QueryDiscogsListingArgs = {
  listingId: Scalars['String']['input'];
};


export type QueryDiscogsOrdersArgs = {
  page: Scalars['Int']['input'];
};


export type QueryDiscogsSearchArgs = {
  term: Scalars['String']['input'];
  type: InputMaybe<Scalars['String']['input']>;
};


export type QueryFeedGetIntervalsArgs = {
  favorites: InputMaybe<Scalars['Boolean']['input']>;
  userRef: Scalars['ID']['input'];
};


export type QueryFeedGetPostArgs = {
  postRef: Scalars['ID']['input'];
  userRef: Scalars['ID']['input'];
};


export type QueryInventoryArgs = {
  artists: InputMaybe<Array<InputMaybe<Scalars['Float']['input']>>>;
  categories: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  condition: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  createdBy: InputMaybe<Scalars['ID']['input']>;
  dateFilter: InputMaybe<Scalars['String']['input']>;
  discogsStatus: InputMaybe<Scalars['String']['input']>;
  filters: InputMaybe<InventoryFilters>;
  from: InputMaybe<Scalars['String']['input']>;
  genres: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  hasSnippet: InputMaybe<Scalars['String']['input']>;
  itemId: InputMaybe<Scalars['Float']['input']>;
  labels: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  limit: InputMaybe<Scalars['Int']['input']>;
  location: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  locationSearch: InputMaybe<Scalars['String']['input']>;
  order: InputMaybe<Scalars['String']['input']>;
  page: InputMaybe<Scalars['Int']['input']>;
  preOrder: InputMaybe<Scalars['Boolean']['input']>;
  secondHand: InputMaybe<Scalars['Boolean']['input']>;
  sort: InputMaybe<Scalars['String']['input']>;
  status: InputMaybe<Scalars['String']['input']>;
  stock: InputMaybe<Scalars['String']['input']>;
  styles: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  supplierCode: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  term: InputMaybe<Scalars['String']['input']>;
  to: InputMaybe<Scalars['String']['input']>;
  type: InputMaybe<Scalars['String']['input']>;
};


export type QueryInventoryBulkEstimateArgs = {
  fields: Scalars['JSON']['input'];
  listingRefs: Array<Scalars['String']['input']>;
};


export type QueryInventoryExportStickersArgs = {
  listingRefs: Array<Scalars['String']['input']>;
};


export type QueryInventoryLocationsArgs = {
  limit: InputMaybe<Scalars['Int']['input']>;
  offset: InputMaybe<Scalars['Int']['input']>;
  page: InputMaybe<Scalars['Int']['input']>;
  term: InputMaybe<Scalars['String']['input']>;
};


export type QueryInventoryMetadataArgs = {
  filters: InventoryFilters;
};


export type QueryInventorySuppliersArgs = {
  limit: InputMaybe<Scalars['Int']['input']>;
  page: Scalars['Int']['input'];
  term: InputMaybe<Scalars['String']['input']>;
};


export type QueryItemArgs = {
  id: InputMaybe<Scalars['Long']['input']>;
  itemRef: InputMaybe<Scalars['ID']['input']>;
  listingRef: InputMaybe<Scalars['ID']['input']>;
};


export type QueryItemArtistsArgs = {
  limit: InputMaybe<Scalars['Int']['input']>;
  page: InputMaybe<Scalars['Int']['input']>;
  term: InputMaybe<Scalars['String']['input']>;
};


export type QueryItemBookSearchArgs = {
  term: Scalars['String']['input'];
};


export type QueryItemFromDatabaseArgs = {
  creatorsId: InputMaybe<Scalars['String']['input']>;
  discogsId: InputMaybe<Scalars['Int']['input']>;
};


export type QueryItemLabelsArgs = {
  limit: InputMaybe<Scalars['Int']['input']>;
  page: InputMaybe<Scalars['Int']['input']>;
  term: InputMaybe<Scalars['String']['input']>;
};


export type QueryItemPriceSuggestionsArgs = {
  discogsId: InputMaybe<Scalars['Long']['input']>;
  id: InputMaybe<Scalars['Long']['input']>;
};


export type QueryItemSalesStatisticsArgs = {
  itemRef: Scalars['ID']['input'];
  limit: InputMaybe<Scalars['Int']['input']>;
  page: InputMaybe<Scalars['Int']['input']>;
};


export type QueryItemSearchArgs = {
  quantitySort: InputMaybe<Scalars['Boolean']['input']>;
  stocked: InputMaybe<Scalars['Boolean']['input']>;
  term: Scalars['String']['input'];
  type: InputMaybe<Scalars['String']['input']>;
};


export type QueryItemStatisticsArgs = {
  from: InputMaybe<Scalars['Date']['input']>;
  granularity: InputMaybe<StatisticsGranularity>;
  itemRef: Scalars['ID']['input'];
  to: InputMaybe<Scalars['Date']['input']>;
};


export type QueryItemStatsForIdsArgs = {
  ids: Array<Scalars['Long']['input']>;
};


export type QueryItemsArgs = {
  ids: InputMaybe<Array<Scalars['Long']['input']>>;
  itemRefs: InputMaybe<Array<Scalars['ID']['input']>>;
};


export type QueryListArgs = {
  listRef: Scalars['ID']['input'];
};


export type QueryMediaArgs = {
  extensions: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id: InputMaybe<Scalars['Int']['input']>;
  ids: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  limit: InputMaybe<Scalars['Int']['input']>;
  mediaRef: InputMaybe<Scalars['ID']['input']>;
  page: InputMaybe<Scalars['Int']['input']>;
};


export type QueryMessageArgs = {
  messageRef: Scalars['ID']['input'];
};


export type QueryMessagesArgs = {
  from: InputMaybe<FromEnum>;
  orderRef: InputMaybe<Scalars['String']['input']>;
  page: InputMaybe<Scalars['Int']['input']>;
};


export type QueryOrderArgs = {
  id: InputMaybe<Scalars['String']['input']>;
  ref: InputMaybe<Scalars['ID']['input']>;
};


export type QueryOrderCarrierRatesArgs = {
  orderRef: Scalars['ID']['input'];
};


export type QueryOrderSearchArgs = {
  term: Scalars['String']['input'];
};


export type QueryOrdersArgs = {
  ordersFiltersInput: OrdersFiltersInput;
};


export type QueryOrdersConnectionArgs = {
  billingStatus: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  buyerRef: InputMaybe<Scalars['ID']['input']>;
  dateFilter: InputMaybe<Scalars['String']['input']>;
  from: InputMaybe<Scalars['Date']['input']>;
  itemRef: InputMaybe<Scalars['ID']['input']>;
  limit: InputMaybe<Scalars['Int']['input']>;
  order: InputMaybe<Scalars['Int']['input']>;
  origin: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  page: InputMaybe<Scalars['Int']['input']>;
  paymentMethods: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  shippingStatus: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  sort: InputMaybe<Scalars['String']['input']>;
  status: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  term: InputMaybe<Scalars['String']['input']>;
  to: InputMaybe<Scalars['Date']['input']>;
};


export type QueryOrdersReportArgs = {
  ordersFiltersInput: OrdersFiltersInput;
};


export type QueryOrdersStatisticsArgs = {
  ordersFiltersInput: OrdersFiltersInput;
};


export type QueryPlaylistArgs = {
  id: Scalars['Int']['input'];
};


export type QueryPlaylistsArgs = {
  page: InputMaybe<Scalars['Int']['input']>;
};


export type QueryUserArgs = {
  userRef: Scalars['ID']['input'];
};


export type QueryUserSearchArgs = {
  term: Scalars['String']['input'];
};


export type QueryUserWantlistArgs = {
  page: Scalars['Int']['input'];
  userRef: Scalars['ID']['input'];
};


export type QueryUsersArgs = {
  listRef: InputMaybe<Scalars['ID']['input']>;
  page: InputMaybe<Scalars['Int']['input']>;
  pagination: InputMaybe<PaginationInput>;
  perPage: InputMaybe<Scalars['Int']['input']>;
  term: InputMaybe<Scalars['String']['input']>;
};


export type QueryVouchersArgs = {
  expired: InputMaybe<Scalars['String']['input']>;
  limit: InputMaybe<Scalars['Int']['input']>;
  page: InputMaybe<Scalars['Int']['input']>;
  sort: InputMaybe<Scalars['String']['input']>;
  sortBy: InputMaybe<Scalars['String']['input']>;
  sortOrder: InputMaybe<Scalars['Int']['input']>;
  status: InputMaybe<Scalars['String']['input']>;
  term: InputMaybe<Scalars['String']['input']>;
  type: InputMaybe<Scalars['String']['input']>;
  userRef: InputMaybe<Scalars['ID']['input']>;
  voucherId: InputMaybe<Scalars['String']['input']>;
};

/** Redemption type for vouchers, determining how the discount is calculated. */
export type RedeemType =
  | 'percentage'
  | 'value';

/** Input for registering an audio snippet for a release. */
export type RegisterAudioInput = {
  key: Scalars['String']['input'];
  position: Scalars['String']['input'];
};

/** Artist information associated with a release. */
export type ReleaseArtist = {
  __typename?: 'ReleaseArtist';
  /** Artist name variation (ANV - Artist Name Variation). */
  anv: Maybe<Scalars['String']['output']>;
  /** External identifier for the artist from the marketplace system. */
  id: Maybe<Scalars['Float']['output']>;
  /** Join phrase connecting multiple artists (e.g., "&", "feat."). */
  join: Maybe<Scalars['String']['output']>;
  /** Artist name. */
  name: Maybe<Scalars['String']['output']>;
  /** Role of the artist on this release (e.g., "Producer", "Remix"). */
  role: Maybe<Scalars['String']['output']>;
};

/** Format information for a music release (e.g., vinyl, CD, cassette). */
export type ReleaseFormat = {
  __typename?: 'ReleaseFormat';
  /** Array of format descriptions and classifications. */
  descriptions: Array<Scalars['String']['output']>;
  /** Format name (e.g., "LP", "CD", "Cassette"). */
  name: Maybe<Scalars['String']['output']>;
  /** Quantity of items in this format. */
  qty: Maybe<Scalars['String']['output']>;
  /** Full format description text. */
  text: Maybe<Scalars['String']['output']>;
};

/** Image associated with a release item. */
export type ReleaseImage = {
  __typename?: 'ReleaseImage';
  /** Alternative image representation (e.g., thumbnail or different size). */
  alternative: Maybe<ReleaseImage>;
  /** Height of the image in pixels. */
  height: Maybe<Scalars['Float']['output']>;
  /** URI to access the image. */
  uri: Maybe<Scalars['String']['output']>;
  /** Width of the image in pixels. */
  width: Maybe<Scalars['Float']['output']>;
};

/** Represents a music release item (vinyl, CD, cassette, etc.) with release-specific data. */
export type ReleaseItem = ItemInterface & {
  __typename?: 'ReleaseItem';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Shortened URL via Bitly service. */
  bitly: Maybe<Scalars['String']['output']>;
  /** Date when the item was created. */
  created: Maybe<Scalars['Date']['output']>;
  /** Identifier linking this release to the Creators catalogue. */
  creatorsId: Maybe<Scalars['String']['output']>;
  /** Release-specific data and metadata. */
  data: ReleaseItemData;
  /** Item descriptions in multiple formats. */
  descriptions: ItemDescriptions;
  /**
   * URL-friendly handle for the item.
   * @deprecated Field no longer supported
   */
  handle: Maybe<Scalars['String']['output']>;
  /** Numeric identifier for the item. */
  id: Scalars['Float']['output'];
  /** Incremental identifier assigned to the item. */
  incId: Maybe<Scalars['Float']['output']>;
  /** Whether the item is forbidden from being sold. */
  isForbiddenForSale: Maybe<Scalars['Boolean']['output']>;
  /** Available listings for this item. */
  listings: Array<Listing>;
  /**
   * Historical log entries for the item.
   * @deprecated Field no longer supported
   */
  logs: Maybe<Array<Maybe<LogEntry>>>;
  /** Date when the item was last modified. */
  modified: Maybe<Scalars['Date']['output']>;
  /** Legacy numeric identifier from previous system. */
  oldId: Maybe<Scalars['Float']['output']>;
  /** URL path to the item page. */
  path: Scalars['String']['output'];
  /** SEO metadata for the item. */
  seo: Maybe<SeoEntry>;
  /** Type classification of the item. */
  type: ItemType;
  /** Unique identifier string for the item. */
  uniqueId: Maybe<Scalars['String']['output']>;
  /** URI identifier for the item. */
  uri: Maybe<Scalars['String']['output']>;
  /** Number of users who have added this item to their wantlist. */
  wants: Maybe<Scalars['Int']['output']>;
};

/** Detailed data and metadata specific to release items. */
export type ReleaseItemData = {
  __typename?: 'ReleaseItemData';
  /** Artists associated with the release. */
  artists: Maybe<Array<ReleaseArtist>>;
  /** Country of origin or release country code. */
  country: Maybe<Scalars['String']['output']>;
  /** External identifier from the marketplace system. */
  discogsId: Maybe<Scalars['Float']['output']>;
  /** Format information for the release. */
  formats: Maybe<Array<ReleaseFormat>>;
  /** Musical genres associated with the release. */
  genres: Maybe<Array<Scalars['String']['output']>>;
  /** Identifiers associated with the release (e.g., barcodes, catalog numbers). */
  identifiers: Maybe<Array<ItemDataIdentifier>>;
  /** Images associated with the release. */
  images: Array<ReleaseImage>;
  /** Record labels associated with the release. */
  labels: Maybe<Array<ReleaseLabel>>;
  /** Origin or source of the release data. */
  origin: Maybe<Scalars['String']['output']>;
  /** Release date of the item. */
  releaseDate: Maybe<Scalars['Date']['output']>;
  /** Reference to a content snippet or template. */
  snippetRef: Maybe<Scalars['ID']['output']>;
  /** Musical styles associated with the release. */
  styles: Maybe<Array<Scalars['String']['output']>>;
  /** Title of the release. */
  title: Maybe<Scalars['String']['output']>;
  /** Track listing for the release. */
  tracklist: Maybe<Array<ReleaseTrack>>;
  /** Videos associated with the release. */
  videos: Maybe<Array<Maybe<ReleaseVideo>>>;
  /** Weight of the item in grams or specified unit. */
  weight: Maybe<Scalars['Float']['output']>;
  /** Year of release. */
  year: Maybe<Scalars['Int']['output']>;
};

/** Label information associated with a release. */
export type ReleaseLabel = {
  __typename?: 'ReleaseLabel';
  /** Catalog number assigned by the label. */
  catno: Maybe<Scalars['String']['output']>;
  /** External identifier for the label from the marketplace system. */
  id: Maybe<Scalars['Float']['output']>;
  /** Label name. */
  name: Maybe<Scalars['String']['output']>;
};

/** Track information for a release item. */
export type ReleaseTrack = {
  __typename?: 'ReleaseTrack';
  /** Artists credited on this track. */
  artists: Maybe<Array<ReleaseArtist>>;
  /** Duration of the track (e.g., "3:45"). */
  duration: Maybe<Scalars['String']['output']>;
  /** Number of times the track has been played. */
  plays: Maybe<Scalars['Int']['output']>;
  /** Position of the track on the release (e.g., "A1", "1"). */
  position: Maybe<Scalars['String']['output']>;
  /** Title of the track. */
  title: Maybe<Scalars['String']['output']>;
  /** Track type (e.g., "heading", "track", "index"). */
  type_: Maybe<Scalars['String']['output']>;
  /** URI to access track audio or additional information. */
  uri: Maybe<Scalars['String']['output']>;
};

/** Video content associated with a release item. */
export type ReleaseVideo = {
  __typename?: 'ReleaseVideo';
  /** Duration of the video in seconds. */
  duration: Maybe<Scalars['Int']['output']>;
  /** Title of the video. */
  title: Maybe<Scalars['String']['output']>;
  /** URI to access the video content. */
  uri: Maybe<Scalars['String']['output']>;
};

/** SEO metadata for a page or resource, including title, description, and slug. */
export type SeoEntry = {
  __typename?: 'SeoEntry';
  /** Meta description for search engine results. */
  description: Maybe<Scalars['String']['output']>;
  /** Whether search engines should index this page. */
  index: Maybe<Scalars['Boolean']['output']>;
  /** URL-friendly slug for the page. */
  slug: Maybe<Scalars['String']['output']>;
  /** Snapshot of SEO metadata at a specific point in time. */
  snapshot: Maybe<SeoSnapshot>;
  /** SEO title for the page. */
  title: Maybe<Scalars['String']['output']>;
};

/** Input fields for configuring search engine optimization settings. */
export type SeoInput = {
  /** Meta description that appears in search engine results. */
  description: Scalars['String']['input'];
  /** Whether search engines should index this page. */
  index: Scalars['Boolean']['input'];
  /** URL-friendly slug for the page or resource. */
  slug: Scalars['String']['input'];
  /** SEO title that appears in search results and browser tabs. */
  title: Scalars['String']['input'];
};

/** Snapshot of SEO metadata at a specific point in time. */
export type SeoSnapshot = {
  __typename?: 'SeoSnapshot';
  /** Date when the snapshot was taken. */
  date: Maybe<Scalars['Date']['output']>;
  /** URI of the page at the time of the snapshot. */
  uri: Maybe<Scalars['String']['output']>;
};

/** Shipping information including address, method, status, and tracking details. */
export type Shipping = {
  __typename?: 'Shipping';
  /** Shipping address for the order. */
  address: Maybe<Address>;
  /** Confirmation email sent to the customer regarding shipping. */
  confirmationEmail: Maybe<EmailRecipient>;
  /** Date when the order was shipped or collected. */
  date: Maybe<Scalars['Date']['output']>;
  /** Mirror of this order on the carrier aggregator (Sendcloud/Shippo). */
  externalOrder: Maybe<ShippingExternalOrder>;
  /** Order value threshold above which shipping becomes free. */
  freeShippingThreshold: Maybe<Scalars['Float']['output']>;
  /** Whether shipping has been fulfilled (shipped or collected). */
  fulfilled: Maybe<Scalars['Boolean']['output']>;
  /** Shipping label purchased from the carrier aggregator. */
  label: Maybe<ShippingLabel>;
  /** Selected shipping method name. */
  method: Maybe<Scalars['String']['output']>;
  /** Available shipping method options with costs. */
  methods: Maybe<Array<ShippingMethod>>;
  /** URL to the packing slip document. */
  packingSlip: Maybe<Scalars['String']['output']>;
  /** Shipping price breakdown including base price, taxes, and totals. */
  price: LinePrice;
  /** Whether the order is available for collection at the shop. */
  shopCollection: Maybe<Scalars['Boolean']['output']>;
  /** Current shipping status. */
  status: Maybe<OrderShippingStatus>;
  /** Tracking number or code for the shipment. */
  tracking: Maybe<Scalars['String']['output']>;
  /** Weight of the shipment in grams or specified unit. */
  weight: Maybe<Scalars['Float']['output']>;
};

/** Mirror of an order on the carrier aggregator (Sendcloud/Shippo). */
export type ShippingExternalOrder = {
  __typename?: 'ShippingExternalOrder';
  /** Provider-side order identifier. */
  id: Maybe<Scalars['String']['output']>;
  /** Aggregator the order was created on. Valid values are "sendcloud" or "shippo". */
  provider: Maybe<Scalars['String']['output']>;
};

/** Shipping label purchased from the carrier aggregator (Sendcloud/Shippo). */
export type ShippingLabel = {
  __typename?: 'ShippingLabel';
  /** Carrier name (e.g. "PostNL", "Colissimo"). */
  carrier: Maybe<Scalars['String']['output']>;
  /** URL to download the customs document (CN23 / commercial invoice) for international shipments. */
  customsDocUrl: Maybe<Scalars['String']['output']>;
  /** Friendly name of the service the label was bought with (may differ from the checkout method). */
  method: Maybe<Scalars['String']['output']>;
  /** Deep link to the parcel in the provider's panel. */
  panelUrl: Maybe<Scalars['String']['output']>;
  /** Provider-side parcel identifier (used to fetch parcel documents). */
  parcelId: Maybe<Scalars['String']['output']>;
  /** Aggregator the label was bought from. Valid values are "sendcloud" or "shippo". */
  provider: Maybe<Scalars['String']['output']>;
  /** Provider-side shipment identifier. */
  shipmentId: Maybe<Scalars['String']['output']>;
  /** Carrier tracking number for the parcel. */
  trackingNumber: Maybe<Scalars['String']['output']>;
  /** URL to download the label document (PDF). */
  url: Maybe<Scalars['String']['output']>;
};

/**
 * Shipping method option. Static policy methods carry name and total only;
 * methods quoted live by the shipping service (Sendcloud/Shippo) also fill the carrier fields.
 */
export type ShippingMethod = {
  __typename?: 'ShippingMethod';
  /** Carrier name (e.g. "PostNL", "Colissimo"). */
  carrier: Maybe<Scalars['String']['output']>;
  /** Sendcloud contract identifier required when purchasing the label. */
  contractId: Maybe<Scalars['Int']['output']>;
  /** ISO 4217 currency of the quoted price. */
  currency: Maybe<Scalars['String']['output']>;
  /** Estimated delivery time in days. */
  estimatedDays: Maybe<Scalars['Int']['output']>;
  /** Name of the shipping method (e.g., "Standard Shipping", "Express Delivery"). */
  name: Maybe<Scalars['String']['output']>;
  /** Aggregator the quote came from. Valid values are "sendcloud" or "shippo". */
  provider: Maybe<Scalars['String']['output']>;
  /** Provider rate identifier — Shippo rate object id or Sendcloud shipping option code. */
  rateId: Maybe<Scalars['String']['output']>;
  /** Service level name (e.g. "Standard", "Express"). */
  service: Maybe<Scalars['String']['output']>;
  /** Whether this option requires delivery to a service point. */
  servicePointRequired: Maybe<Scalars['Boolean']['output']>;
  /** Total cost for this shipping method. */
  total: Maybe<Scalars['Float']['output']>;
};

/** Type of shipping policy calculation method. */
export type ShippingPolicyTypes =
  | 'quantity'
  | 'value'
  | 'weight';

/** Input for getting a signed URL for uploading an audio snippet for a release. */
export type SignedUrlInput = {
  position: Scalars['String']['input'];
};

/** A newsletter campaign event that featured the item, shown as a marker on the chart. */
export type StatisticsCampaignEvent = {
  __typename?: 'StatisticsCampaignEvent';
  /** The MongoDB reference of the campaign. */
  campaignRef: Scalars['ID']['output'];
  /** Date the campaign was sent. */
  date: Scalars['Date']['output'];
  /** Title of the mailing list the campaign was sent to. */
  listTitle: Maybe<Scalars['String']['output']>;
  /** Number of recipients. */
  recipientsCount: Maybe<Scalars['Int']['output']>;
  /** Campaign title. */
  title: Scalars['String']['output'];
};

/** A country and its order count, used for the country sales breakdown. */
export type StatisticsCountryPoint = {
  __typename?: 'StatisticsCountryPoint';
  /** ISO 3166-1 alpha-2 country code. */
  alpha2: Scalars['String']['output'];
  /** Number of orders shipped to this country. */
  count: Scalars['Int']['output'];
};

/** A single data point in a statistics time series. */
export type StatisticsDataPoint = {
  __typename?: 'StatisticsDataPoint';
  /** The bucket start date (truncated to the granularity unit, UTC). */
  date: Scalars['Date']['output'];
  /** Number of page views recorded in this bucket. */
  pageViews: Scalars['Int']['output'];
  /** Number of units sold in this bucket. Null for article statistics. */
  sold: Maybe<Scalars['Int']['output']>;
};

/** Time bucket granularity used for the statistics series. */
export type StatisticsGranularity =
  | 'day'
  | 'hour'
  | 'week';

/** A single stock quantity reading extracted from item logs. */
export type StatisticsStockPoint = {
  __typename?: 'StatisticsStockPoint';
  /** Timestamp of the stock update. */
  date: Scalars['Date']['output'];
  /** Stock quantity after the update. */
  quantity: Scalars['Int']['output'];
};

/** Represents a supplier (vendor or manufacturer) that provides inventory items. */
export type Supplier = {
  __typename?: 'Supplier';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** List of addresses for the supplier. */
  addresses: Array<Address>;
  /** List of contact persons for the supplier. */
  contacts: Array<SupplierContact>;
  /** Date when the supplier was created. */
  createdAt: Scalars['Date']['output'];
  /** User who created the supplier. */
  createdBy: Maybe<UserReference>;
  /** Short unique identifier for the supplier, generated as a 10-digit code. */
  id: Scalars['String']['output'];
  /** Date when the supplier was last modified. */
  modifiedAt: Scalars['Date']['output'];
  /** Supplier name. */
  name: Scalars['String']['output'];
  /** Reporting configuration for supplier data access. */
  reporting: Maybe<SupplierReporting>;
  /** Tax identification number or tax information. */
  taxInformation: Maybe<Scalars['String']['output']>;
};

/** Contact person information for a supplier. */
export type SupplierContact = {
  __typename?: 'SupplierContact';
  /** Contact's email address. */
  email: Maybe<Scalars['String']['output']>;
  /** Contact's first name. */
  firstName: Scalars['String']['output'];
  /** Contact's last name. */
  lastName: Maybe<Scalars['String']['output']>;
  /** Organization or company name. */
  organisation: Maybe<Scalars['String']['output']>;
  /** Contact's telephone number. */
  telephone: Maybe<Scalars['String']['output']>;
};

/** Reporting configuration for supplier data access. */
export type SupplierReporting = {
  __typename?: 'SupplierReporting';
  /** List of reporting links for accessing supplier data. */
  links: Array<SupplierReportingLink>;
};

/** Reporting link for supplier data access. */
export type SupplierReportingLink = {
  __typename?: 'SupplierReportingLink';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Date when the link was created. */
  createdAt: Scalars['Date']['output'];
  /** User who created the link. */
  createdBy: UserReference;
  /** Date when the link expires. */
  expires: Maybe<Scalars['Date']['output']>;
  /** Link identifier. */
  id: Scalars['String']['output'];
  /** URI to access the reporting data. */
  uri: Scalars['String']['output'];
};

/** Input fields for updating supplier information, including tax information, addresses, and contacts. */
export type SupplierUpdateInput = {
  /** List of addresses associated with the supplier. */
  addresses?: InputMaybe<Array<AddressInput>>;
  /** List of contact information for the supplier. */
  contacts?: InputMaybe<Array<ContactInput>>;
  /** The name of the supplier. */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Tax identification information for the supplier. */
  taxInformation?: InputMaybe<Scalars['String']['input']>;
};

export type SupportTicketAttachment = {
  __typename?: 'SupportTicketAttachment';
  _id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  size: Scalars['Int']['output'];
  url: Maybe<Scalars['String']['output']>;
};

export type SupportTicketCreateAttachmentsInput = {
  /** Name of the file to upload. The filename will be sanitized and used as the S3 key. */
  filename: Scalars['String']['input'];
  /** Size of the file. */
  size: Scalars['Int']['input'];
};

export type SupportTicketMessage = {
  __typename?: 'SupportTicketMessage';
  _id: Scalars['ID']['output'];
  attachments: Array<SupportTicketAttachment>;
  content: Scalars['String']['output'];
  createdAt: Scalars['Date']['output'];
  senderRef: UserReference;
};

/** Tax information including name, amount, and rate. */
export type Tax = {
  __typename?: 'Tax';
  /** Tax amount in the shop's currency. */
  amount: Maybe<Scalars['Float']['output']>;
  /** Name of the tax (e.g., "VAT", "Sales Tax"). */
  name: Maybe<Scalars['String']['output']>;
  /** Tax rate as a percentage (e.g., 20.0 for 20%). */
  rate: Maybe<Scalars['Float']['output']>;
};

/** Defines a tax applied to a transaction or item, including its name and rate. */
export type TaxInput = {
  /** Name of the tax, such as VAT or sales tax. */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Percentage rate of the tax. */
  rate?: InputMaybe<Scalars['Float']['input']>;
};

export type TicketStatus =
  | 'closed'
  | 'open';

/** Financial totals for an order or checkout, including subtotals, taxes, shipping, and discounts. */
export type Totals = {
  __typename?: 'Totals';
  /** Balance amount (positive or negative). */
  balance: Maybe<Scalars['Float']['output']>;
  /** Credit note amount applied. */
  creditNote: Maybe<Scalars['Float']['output']>;
  /** Total discount amount applied. */
  discount: Maybe<Scalars['Float']['output']>;
  /** Grand total including all items, taxes, shipping, and discounts. */
  grand: Scalars['Float']['output'];
  /** Total quantity of items in the order. */
  itemQuantity: Maybe<Scalars['Float']['output']>;
  /** Remaining amount left to pay (grand total minus payments received). */
  leftToPay: Scalars['Float']['output'];
  /** Shipping cost. */
  shipping: Maybe<Scalars['Float']['output']>;
  /** Subtotal after discounts and before taxes. */
  subtotal: Maybe<Scalars['Float']['output']>;
  /** Subtotal before taxes are applied. */
  subtotalBeforeTaxes: Maybe<Scalars['Float']['output']>;
  /** Total tax amount across all tax definitions. */
  tax: Maybe<Scalars['Float']['output']>;
  /** Tax breakdown by tax definition. */
  taxes: Maybe<Array<Tax>>;
};

/** Input fields for updating a buyer's information, including personal details, contact information, addresses, and list memberships. */
export type UserBuyerUpdateInput = {
  /** List of addresses for the buyer. Replaces the buyer's current addresses. */
  addresses?: InputMaybe<Array<InputMaybe<AddressInput>>>;
  /** Birthdate of the buyer. */
  birthdate?: InputMaybe<Scalars['Date']['input']>;
  /** Email address of the buyer. Must be unique within the shop. */
  email: Scalars['String']['input'];
  /** First name of the buyer. */
  firstName: Scalars['String']['input'];
  /** Last name of the buyer. */
  lastName: Scalars['String']['input'];
  /** List of customer list reference IDs to associate the buyer with. Replaces the buyer's current list memberships. */
  lists?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  /** Notes or comments about the buyer. */
  notes?: InputMaybe<Scalars['String']['input']>;
  /** Organization or company name associated with the buyer. */
  organisation?: InputMaybe<Scalars['String']['input']>;
  /** Tax identification number for the buyer. */
  taxNumber?: InputMaybe<Scalars['String']['input']>;
  /** Telephone number of the buyer. */
  telephone?: InputMaybe<Scalars['String']['input']>;
};

/** Notification setting entry specifying email and backoffice notification preferences. */
export type UserNotificationSettingEntry = {
  __typename?: 'UserNotificationSettingEntry';
  /** Whether backoffice notifications are enabled. */
  backoffice: Maybe<Scalars['Boolean']['output']>;
  /** Whether email notifications are enabled. */
  email: Maybe<Scalars['Boolean']['output']>;
};

/** Reference to a user with basic identification information. */
export type UserReference = {
  __typename?: 'UserReference';
  /** User's email address. */
  email: Maybe<Scalars['String']['output']>;
  /** User's full name. */
  name: Maybe<Scalars['String']['output']>;
  /** Internal database reference identifier. */
  ref: Maybe<Scalars['ID']['output']>;
  /** User type (e.g., "buyer", "admin", "superAdmin"). */
  type: Maybe<Scalars['String']['output']>;
};

/** Email verification information for a user account. */
export type UserVerification = {
  __typename?: 'UserVerification';
  /** Verification code. */
  code: Maybe<Scalars['String']['output']>;
  /** Date when verification was completed. */
  date: Maybe<Scalars['Date']['output']>;
  /** Verification hash. */
  hash: Maybe<Scalars['String']['output']>;
  /** Whether the email has been verified. */
  status: Maybe<Scalars['Boolean']['output']>;
  /** Verification token. */
  token: Maybe<Scalars['String']['output']>;
};

/** Connection type for paginated buyer results with pagination metadata. */
export type UsersConnection = {
  __typename?: 'UsersConnection';
  /** Pagination information including page number, total count, and limit. */
  pagination: Pagination;
  /** List of buyers in the current page. */
  users: Array<Buyer>;
};

/** Represents a voucher (coupon or gift card) with redemption rules and spending history. */
export type Voucher = {
  __typename?: 'Voucher';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Date when the voucher was created. */
  created: Maybe<Scalars['Date']['output']>;
  /** User who created the voucher. */
  createdBy: Maybe<UserReference>;
  /** Expiration date when the voucher becomes invalid. */
  expires: Maybe<Scalars['Date']['output']>;
  /** Voucher identifier code. */
  id: Scalars['String']['output'];
  /** Whether the voucher is currently within its valid date range. */
  isInRange: Maybe<Scalars['Boolean']['output']>;
  /** Historical log entries tracking changes to the voucher. */
  logs: Maybe<Array<LogEntry>>;
  /** Note or comment associated with the voucher. */
  note: Maybe<Note>;
  /** Original value of the voucher when it was created. */
  originalValue: Maybe<Scalars['Float']['output']>;
  /** URL to the PDF document for the voucher. */
  pdf: Maybe<Scalars['String']['output']>;
  /** Email recipients who received this voucher. */
  recipients: Maybe<Array<VoucherEmailRecipient>>;
  /** How the voucher discount is calculated (fixed value or percentage). */
  redeemType: RedeemType;
  /** Whether the voucher has been fully redeemed. */
  redeemed: Maybe<Scalars['Boolean']['output']>;
  /** URL path to the voucher resource. */
  resourcePath: Maybe<Scalars['String']['output']>;
  /**
   * Whether the voucher can only be used once. Use spendingLimit instead.
   * @deprecated Field no longer supported
   */
  singleSpending: Maybe<Scalars['Boolean']['output']>;
  /** Maximum number of times the voucher can be used. */
  spendingLimit: Maybe<Scalars['Int']['output']>;
  /** History of spending transactions where this voucher was used. */
  spendings: Maybe<Array<VoucherSpending>>;
  /** Start date when the voucher becomes valid. */
  startDate: Maybe<Scalars['Date']['output']>;
  /** Type of voucher (coupon or gift card). */
  type: VoucherTypes;
  /**
   * Whether the voucher has unlimited usage. Use spendingLimit instead.
   * @deprecated Field no longer supported
   */
  unlimited: Maybe<Scalars['Boolean']['output']>;
  /** User who owns or is assigned to this voucher. */
  user: Maybe<UserReference>;
  /** Current remaining value of the voucher. */
  value: Scalars['Float']['output'];
};

/** Email recipient who received a voucher. */
export type VoucherEmailRecipient = {
  __typename?: 'VoucherEmailRecipient';
  /** Date when the voucher email was sent. */
  date: Maybe<Scalars['Date']['output']>;
  /** Email address of the recipient. */
  recipient: Maybe<Scalars['String']['output']>;
};

/** Embedded voucher information used within orders or checkouts. */
export type VoucherEmbedded = {
  __typename?: 'VoucherEmbedded';
  /** Internal database identifier. */
  _id: Scalars['ID']['output'];
  /** Date when the voucher was created. */
  created: Maybe<Scalars['Date']['output']>;
  /** User who created the voucher. */
  createdBy: Maybe<UserReference>;
  /** Expiration date when the voucher becomes invalid. */
  expires: Maybe<Scalars['Date']['output']>;
  /** Voucher identifier code. */
  id: Maybe<Scalars['String']['output']>;
  /** Whether the voucher is currently within its valid date range. */
  isInRange: Maybe<Scalars['Boolean']['output']>;
  /** Historical log entries tracking changes to the voucher. */
  logs: Maybe<Array<LogEntry>>;
  /** Note or comment associated with the voucher. */
  note: Maybe<Note>;
  /** Original value of the voucher when it was created. */
  originalValue: Maybe<Scalars['Float']['output']>;
  /** URL to the PDF document for the voucher. */
  pdf: Maybe<Scalars['String']['output']>;
  /** Email recipients who received this voucher. */
  recipients: Maybe<Array<VoucherEmailRecipient>>;
  /** How the voucher discount is calculated (fixed value or percentage). */
  redeemType: Maybe<RedeemType>;
  /** Whether the voucher has been fully redeemed. */
  redeemed: Maybe<Scalars['Boolean']['output']>;
  /** URL path to the voucher resource. */
  resourcePath: Maybe<Scalars['String']['output']>;
  /**
   * Whether the voucher can only be used once. Use spendingLimit instead.
   * @deprecated Field no longer supported
   */
  singleSpending: Maybe<Scalars['Boolean']['output']>;
  /** Maximum number of times the voucher can be used. */
  spendingLimit: Maybe<Scalars['Int']['output']>;
  /** History of spending transactions where this voucher was used. */
  spendings: Maybe<Array<VoucherSpending>>;
  /** Start date when the voucher becomes valid. */
  startDate: Maybe<Scalars['Date']['output']>;
  /** Type of voucher (coupon or gift card). */
  type: Maybe<VoucherTypes>;
  /**
   * Whether the voucher has unlimited usage. Use spendingLimit instead.
   * @deprecated Field no longer supported
   */
  unlimited: Maybe<Scalars['Boolean']['output']>;
  /** User who owns or is assigned to this voucher. */
  user: Maybe<UserReference>;
  /** Current remaining value of the voucher. */
  value: Maybe<Scalars['Float']['output']>;
};

/** Record of voucher spending on a specific order. */
export type VoucherSpending = {
  __typename?: 'VoucherSpending';
  /** Amount of the voucher that was spent on this order. */
  amount: Maybe<Scalars['Float']['output']>;
  /** Date when the voucher was spent. */
  date: Maybe<Scalars['Date']['output']>;
  /** Order identifier string where the voucher was used. */
  orderId: Maybe<Scalars['String']['output']>;
  /** Internal database reference to the order where the voucher was used. */
  orderRef: Maybe<Scalars['ID']['output']>;
  /** Origin or source of the spending record. */
  origin: Maybe<Scalars['String']['output']>;
};

/** Type classification for vouchers. */
export type VoucherTypes =
  | 'coupon'
  | 'giftCard';

/** Connection type for paginated voucher results with pagination metadata. */
export type VouchersConnection = {
  __typename?: 'VouchersConnection';
  /** Pagination information including page number, total count, and limit. */
  pagination: Pagination;
  /** List of vouchers in the current page. */
  vouchers: Array<Voucher>;
};

/** The Google Analytics property/stream selected for the dashboard widget. */
export type GoogleAnalyticsPropertyInput = {
  id: Scalars['String']['input'];
  name: Scalars['String']['input'];
  tracker: Scalars['String']['input'];
};

/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type SampleShopConfigQueryVariables = Exact<{ [key: string]: never; }>;


export type SampleShopConfigQuery = { config: { shopName: string } | null };
