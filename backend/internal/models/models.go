package models

import (
	"time"

	"github.com/google/uuid"
)

// User represents a system user/staff member
type User struct {
	ID           uuid.UUID  `json:"id"`
	Username     string     `json:"username"`
	Email        string     `json:"email"`
	PasswordHash string     `json:"-"` // Don't expose password hash in JSON
	PinHash      *string    `json:"-"` // Don't expose pin hash in JSON
	FirstName    string     `json:"first_name"`
	LastName     string     `json:"last_name"`
	Role         string     `json:"role"` // admin, manager, server, counter, kitchen
	IsActive     bool       `json:"is_active"`
	OrgID        uuid.UUID  `json:"org_id"`
	LocationID   *uuid.UUID `json:"location_id"` // nullable for org-level admins
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// Organization represents a brand/company
type Organization struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	LogoURL   *string   `json:"logo_url"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Location represents a branch/outlet within an organization
type Location struct {
	ID        uuid.UUID `json:"id"`
	OrgID     uuid.UUID `json:"org_id"`
	Name      string    `json:"name"`
	Code      string    `json:"code"`
	Address   *string   `json:"address"`
	Phone     *string   `json:"phone"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// LocationProduct represents a per-location product override
type LocationProduct struct {
	ID            uuid.UUID `json:"id"`
	LocationID    uuid.UUID `json:"location_id"`
	ProductID     uuid.UUID `json:"product_id"`
	PriceOverride *float64  `json:"price_override"`
	IsAvailable   bool      `json:"is_available"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// Category represents a product category
type Category struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	Color       *string   `json:"color"`
	SortOrder   int       `json:"sort_order"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Product represents a menu item/product
type Product struct {
	ID              uuid.UUID  `json:"id"`
	CategoryID      *uuid.UUID `json:"category_id"`
	Name            string     `json:"name"`
	Description     *string    `json:"description"`
	Price           float64    `json:"price"`
	ImageURL        *string    `json:"image_url"`
	Barcode         *string    `json:"barcode"`
	SKU             *string    `json:"sku"`
	IsAvailable     bool       `json:"is_available"`
	PreparationTime int        `json:"preparation_time"` // in minutes
	SortOrder       int        `json:"sort_order"`
	DietaryType     *string    `json:"dietary_type"`     // veg, non-veg, egg, vegan
	CalorieCount    *int       `json:"calorie_count"`
	FoodAllergens   *string    `json:"food_allergens"`
	ProductType     string     `json:"product_type"`     // simple, configurable, combo
	HasOptionGroups   bool       `json:"has_option_groups"`
	MinVariationPrice *float64  `json:"min_variation_price,omitempty"`
	MaxVariationPrice *float64  `json:"max_variation_price,omitempty"`
	LocationIDs       []string  `json:"location_ids,omitempty"` // nil = all locations
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
	Category        *Category  `json:"category,omitempty"`
	OptionGroups    []ProductOptionGroup `json:"option_groups,omitempty"`
	ComboSlots      []ComboSlot          `json:"combo_slots,omitempty"`
}

// ProductOptionGroup represents a group of options for a configurable product
type ProductOptionGroup struct {
	ID            uuid.UUID           `json:"id"`
	ProductID     uuid.UUID           `json:"product_id"`
	Name          string              `json:"name"`
	SelectionType string              `json:"selection_type"` // single, multiple
	IsRequired    bool                `json:"is_required"`
	MinSelections int                 `json:"min_selections"`
	MaxSelections int                 `json:"max_selections"`
	SortOrder     int                 `json:"sort_order"`
	CreatedAt     time.Time           `json:"created_at"`
	UpdatedAt     time.Time           `json:"updated_at"`
	Items         []ProductOptionItem `json:"items,omitempty"`
}

// ProductOptionItem represents a single option within a group
type ProductOptionItem struct {
	ID              uuid.UUID `json:"id"`
	OptionGroupID   uuid.UUID `json:"option_group_id"`
	Name            string    `json:"name"`
	PriceAdjustment float64  `json:"price_adjustment"`
	IsDefault       bool      `json:"is_default"`
	IsAvailable     bool      `json:"is_available"`
	SortOrder       int       `json:"sort_order"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// OrderItemOption represents a selected option saved with an order item (denormalized)
type OrderItemOption struct {
	ID              uuid.UUID `json:"id"`
	OrderItemID     uuid.UUID `json:"order_item_id"`
	OptionGroupName string    `json:"option_group_name"`
	OptionItemName  string    `json:"option_item_name"`
	PriceAdjustment float64  `json:"price_adjustment"`
	CreatedAt       time.Time `json:"created_at"`
}

// Customer represents a customer with phone-based lookup
type Customer struct {
	ID          uuid.UUID  `json:"id"`
	Phone       string     `json:"phone"`
	Name        *string    `json:"name"`
	Email       *string    `json:"email"`
	Address     *string    `json:"address"`
	Notes       *string    `json:"notes"`
	TotalOrders int        `json:"total_orders"`
	TotalSpent  float64    `json:"total_spent"`
	LastOrderAt *time.Time `json:"last_order_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// DiningTable represents a table or dining area
type DiningTable struct {
	ID              uuid.UUID `json:"id"`
	TableNumber     string    `json:"table_number"`
	SeatingCapacity int       `json:"seating_capacity"`
	Location        *string   `json:"location"`
	Floor           *string   `json:"floor"`
	Status          string    `json:"status"`
	IsOccupied      bool      `json:"is_occupied"`
	LocationID      string    `json:"location_id,omitempty"`
	LocationName    string    `json:"location_name,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	CurrentOrder    *Order    `json:"current_order,omitempty"`
}

// Order represents a customer order or a KOT (Kitchen Order Ticket)
// For dine-in: multiple KOTs can be grouped under a parent bill order
type Order struct {
	ID             uuid.UUID    `json:"id"`
	OrderNumber    string       `json:"order_number"`
	TableID        *uuid.UUID   `json:"table_id"`
	UserID         *uuid.UUID   `json:"user_id"`
	CustomerID     *uuid.UUID   `json:"customer_id"`
	CustomerName   *string      `json:"customer_name"`
	OrderType      string       `json:"order_type"` // dine_in, takeout, delivery
	Status         string       `json:"status"`     // pending, confirmed, preparing, ready, served, completed, cancelled
	Subtotal       float64      `json:"subtotal"`
	TaxAmount      float64      `json:"tax_amount"`
	DiscountAmount float64      `json:"discount_amount"`
	TotalAmount    float64      `json:"total_amount"`
	Notes          *string      `json:"notes"`
	CreatedAt      time.Time    `json:"created_at"`
	UpdatedAt      time.Time    `json:"updated_at"`
	ServedAt       *time.Time   `json:"served_at"`
	CompletedAt    *time.Time   `json:"completed_at"`
	ConfirmedAt    *time.Time   `json:"confirmed_at"`
	PreparingAt    *time.Time   `json:"preparing_at"`
	ReadyAt        *time.Time   `json:"ready_at"`
	PaidAt         *time.Time   `json:"paid_at"`
	ClearedAt      *time.Time   `json:"cleared_at"`
	// KOT support fields
	ParentOrderID *uuid.UUID `json:"parent_order_id"` // For KOTs: references the parent bill
	IsKOT         bool       `json:"is_kot"`          // True if this is a Kitchen Order Ticket
	KOTNumber     *string    `json:"kot_number"`      // Sequential KOT number (KOT001, KOT002)
	TokenNumber   *int       `json:"token_number"`    // Daily sequential token (1, 2, 3...) for customer display
	// Aggregator order fields
	OrderSource          string     `json:"order_source"`           // pos, swiggy, zomato
	ExternalOrderID      *string    `json:"external_order_id"`      // Platform's order ID
	ExternalData         *string    `json:"external_data"`          // Raw JSON from platform
	DeliveryPartnerName  *string    `json:"delivery_partner_name"`  // Delivery rider name
	DeliveryPartnerPhone *string    `json:"delivery_partner_phone"` // Delivery rider phone
	AggregatorConfirmedAt *time.Time `json:"aggregator_confirmed_at"`
	AcceptDeadline       *time.Time `json:"accept_deadline"`        // Auto-reject if not accepted by this time
	// Relations
	Table       *DiningTable `json:"table,omitempty"`
	User        *User        `json:"user,omitempty"`
	Customer    *Customer    `json:"customer,omitempty"`
	Items       []OrderItem  `json:"items,omitempty"`
	Payments    []Payment    `json:"payments,omitempty"`
	KOTs        []Order      `json:"kots,omitempty"`         // Child KOTs (for parent bill orders)
	ParentOrder *Order       `json:"parent_order,omitempty"` // Parent bill (for KOT orders)
}

// OrderItem represents an item within an order
type OrderItem struct {
	ID                  uuid.UUID         `json:"id"`
	OrderID             uuid.UUID         `json:"order_id"`
	ProductID           uuid.UUID         `json:"product_id"`
	Quantity            int               `json:"quantity"`
	UnitPrice           float64           `json:"unit_price"`
	TotalPrice          float64           `json:"total_price"`
	SpecialInstructions *string           `json:"special_instructions"`
	Status              string            `json:"status"` // pending, preparing, ready, served
	CreatedAt           time.Time         `json:"created_at"`
	UpdatedAt           time.Time         `json:"updated_at"`
	Product             *Product                `json:"product,omitempty"`
	Options             []OrderItemOption       `json:"options,omitempty"`
	ComboChoices        []OrderItemComboChoice  `json:"combo_choices,omitempty"`
}

// Payment represents a payment transaction
type Payment struct {
	ID              uuid.UUID  `json:"id"`
	OrderID         uuid.UUID  `json:"order_id"`
	PaymentMethod   string     `json:"payment_method"` // cash, credit_card, debit_card, digital_wallet
	Amount          float64    `json:"amount"`
	CashReceived    *float64   `json:"cash_received,omitempty"`
	ChangeAmount    *float64   `json:"change_amount,omitempty"`
	ReferenceNumber *string    `json:"reference_number"`
	Status          string     `json:"status"` // pending, completed, failed, refunded
	ProcessedBy     *uuid.UUID `json:"processed_by"`
	ProcessedAt     *time.Time `json:"processed_at"`
	CreatedAt       time.Time  `json:"created_at"`
	ProcessedByUser *User      `json:"processed_by_user,omitempty"`
}

// Inventory represents product inventory
type Inventory struct {
	ID              uuid.UUID  `json:"id"`
	ProductID       uuid.UUID  `json:"product_id"`
	CurrentStock    int        `json:"current_stock"`
	MinimumStock    int        `json:"minimum_stock"`
	MaximumStock    int        `json:"maximum_stock"`
	UnitCost        *float64   `json:"unit_cost"`
	LastRestockedAt *time.Time `json:"last_restocked_at"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	Product         *Product   `json:"product,omitempty"`
}

// OrderStatusHistory tracks order status changes
type OrderStatusHistory struct {
	ID             uuid.UUID  `json:"id"`
	OrderID        uuid.UUID  `json:"order_id"`
	PreviousStatus *string    `json:"previous_status"`
	NewStatus      string     `json:"new_status"`
	ChangedBy      *uuid.UUID `json:"changed_by"`
	Notes          *string    `json:"notes"`
	CreatedAt      time.Time  `json:"created_at"`
	ChangedByUser  *User      `json:"changed_by_user,omitempty"`
}

// Request/Response DTOs

// CreateOrderRequest represents the request to create a new order
type CreateOrderRequest struct {
	TableID       *uuid.UUID        `json:"table_id"`
	CustomerID    *uuid.UUID        `json:"customer_id"`
	CustomerName  *string           `json:"customer_name"`
	OrderType     string            `json:"order_type"`
	Status        *string           `json:"status"`          // Optional: allows setting initial status (for quick POS)
	Items         []CreateOrderItem `json:"items"`
	Notes         *string           `json:"notes"`
	ParentOrderID *uuid.UUID        `json:"parent_order_id"` // For KOT: link to existing bill
	CreateAsKOT   bool              `json:"create_as_kot"`   // If true for dine_in, creates bill + KOT structure
	OrderSource   string            `json:"order_source"`    // Order origin: pos, kiosk, swiggy, zomato
}

// CreateCustomerRequest represents the request to create a customer
type CreateCustomerRequest struct {
	Phone   string  `json:"phone" binding:"required"`
	Name    *string `json:"name"`
	Email   *string `json:"email"`
	Address *string `json:"address"`
	Notes   *string `json:"notes"`
}

// UpdateCustomerRequest represents the request to update a customer
type UpdateCustomerRequest struct {
	Phone   *string `json:"phone"`
	Name    *string `json:"name"`
	Email   *string `json:"email"`
	Address *string `json:"address"`
	Notes   *string `json:"notes"`
}

// CreateOrderItem represents an item in the order creation request
type CreateOrderItem struct {
	ProductID           uuid.UUID                    `json:"product_id"`
	Quantity            int                          `json:"quantity"`
	SpecialInstructions *string                      `json:"special_instructions"`
	SelectedOptions     []CreateOrderItemOption       `json:"selected_options"`
	ComboChoices        []CreateOrderItemComboChoice  `json:"combo_choices"`
}

// CreateOrderItemOption represents a selected option in an order item creation request
type CreateOrderItemOption struct {
	OptionGroupName string  `json:"option_group_name"`
	OptionItemName  string  `json:"option_item_name"`
	PriceAdjustment float64 `json:"price_adjustment"`
}

// UpdateOrderStatusRequest represents the request to update order status
type UpdateOrderStatusRequest struct {
	Status string  `json:"status"`
	Notes  *string `json:"notes"`
}

// ProcessPaymentRequest represents the request to process a payment
type ProcessPaymentRequest struct {
	PaymentMethod   string   `json:"payment_method"`
	Amount          float64  `json:"amount"`
	CashReceived    *float64 `json:"cash_received"`
	ChangeAmount    *float64 `json:"change_amount"`
	ReferenceNumber *string  `json:"reference_number"`
	CustomerID      *string  `json:"customer_id"`
	CustomerName    *string  `json:"customer_name"`
}

// LoginRequest represents the login request
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Pin      string `json:"pin"`
}

// LoginResponse represents the login response
type LoginResponse struct {
	Token        string        `json:"token"`
	User         User          `json:"user"`
	Organization *Organization `json:"organization,omitempty"`
	Location     *Location     `json:"location,omitempty"`
	Locations    []Location    `json:"locations"`
}

// CreateLocationRequest represents the request to create/update a location
type CreateLocationRequest struct {
	Name    string  `json:"name" binding:"required"`
	Code    string  `json:"code" binding:"required"`
	Address *string `json:"address"`
	Phone   *string `json:"phone"`
}

// UpdateLocationRequest represents the request to update a location
type UpdateLocationRequest struct {
	Name     *string `json:"name"`
	Code     *string `json:"code"`
	Address  *string `json:"address"`
	Phone    *string `json:"phone"`
	IsActive *bool   `json:"is_active"`
}

// LocationProductOverrideRequest represents the request to set a product override
type LocationProductOverrideRequest struct {
	PriceOverride *float64 `json:"price_override"`
	IsAvailable   *bool    `json:"is_available"`
}

// APIResponse represents a generic API response
type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
	Error   *string     `json:"error,omitempty"`
}

// PaginatedResponse represents a paginated API response
type PaginatedResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
	Meta    MetaData    `json:"meta"`
}

// MetaData represents pagination metadata
type MetaData struct {
	CurrentPage int `json:"current_page"`
	PerPage     int `json:"per_page"`
	Total       int `json:"total"`
	TotalPages  int `json:"total_pages"`
}

// BillSummaryResponse represents an aggregated bill with all its KOTs
type BillSummaryResponse struct {
	Bill               Order   `json:"bill"`
	KOTs               []Order `json:"kots"`
	TotalItems         int     `json:"total_items"`
	AggregatedSubtotal float64 `json:"aggregated_subtotal"`
	AggregatedTax      float64 `json:"aggregated_tax"`
	AggregatedDiscount float64 `json:"aggregated_discount"`
	AggregatedTotal    float64 `json:"aggregated_total"`
	PaidAmount         float64 `json:"paid_amount"`
	IsBillClosed       bool    `json:"is_bill_closed"`
}

// CreateOptionGroupRequest represents the request to create an option group
type CreateOptionGroupRequest struct {
	Name          string                    `json:"name" binding:"required"`
	SelectionType string                    `json:"selection_type" binding:"required"`
	IsRequired    bool                      `json:"is_required"`
	MinSelections int                       `json:"min_selections"`
	MaxSelections int                       `json:"max_selections"`
	SortOrder     int                       `json:"sort_order"`
	Items         []CreateOptionItemRequest `json:"items"`
}

// CreateOptionItemRequest represents the request to create an option item
type CreateOptionItemRequest struct {
	Name            string  `json:"name" binding:"required"`
	PriceAdjustment float64 `json:"price_adjustment"`
	IsDefault       bool    `json:"is_default"`
	SortOrder       int     `json:"sort_order"`
}

// UpdateOptionGroupRequest represents the request to update an option group
type UpdateOptionGroupRequest struct {
	Name          *string `json:"name"`
	SelectionType *string `json:"selection_type"`
	IsRequired    *bool   `json:"is_required"`
	MinSelections *int    `json:"min_selections"`
	MaxSelections *int    `json:"max_selections"`
	SortOrder     *int    `json:"sort_order"`
}

// UpdateOptionItemRequest represents the request to update an option item
type UpdateOptionItemRequest struct {
	Name            *string  `json:"name"`
	PriceAdjustment *float64 `json:"price_adjustment"`
	IsDefault       *bool    `json:"is_default"`
	IsAvailable     *bool    `json:"is_available"`
	SortOrder       *int     `json:"sort_order"`
}

// VariationGroup represents an org-scoped global variation group
type VariationGroup struct {
	ID            uuid.UUID       `json:"id"`
	OrgID         uuid.UUID       `json:"org_id"`
	Name          string          `json:"name"`
	SelectionType string          `json:"selection_type"`
	IsRequired    bool            `json:"is_required"`
	MinSelections int             `json:"min_selections"`
	MaxSelections int             `json:"max_selections"`
	SortOrder     int             `json:"sort_order"`
	IsActive      bool            `json:"is_active"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
	Items         []VariationItem `json:"items,omitempty"`
	ProductCount  int             `json:"product_count,omitempty"`
}

// VariationItem represents a single item within a global variation group
type VariationItem struct {
	ID               uuid.UUID `json:"id"`
	VariationGroupID uuid.UUID `json:"variation_group_id"`
	Name             string    `json:"name"`
	PriceAdjustment  float64   `json:"price_adjustment"`
	IsDefault        bool      `json:"is_default"`
	IsAvailable      bool      `json:"is_available"`
	SortOrder        int       `json:"sort_order"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// CreateVariationGroupRequest represents the request to create a global variation group
type CreateVariationGroupRequest struct {
	Name          string                       `json:"name" binding:"required"`
	SelectionType string                       `json:"selection_type" binding:"required"`
	IsRequired    bool                         `json:"is_required"`
	MinSelections int                          `json:"min_selections"`
	MaxSelections int                          `json:"max_selections"`
	SortOrder     int                          `json:"sort_order"`
	Items         []CreateVariationItemRequest `json:"items"`
}

// CreateVariationItemRequest represents the request to create a variation item
type CreateVariationItemRequest struct {
	Name            string  `json:"name" binding:"required"`
	PriceAdjustment float64 `json:"price_adjustment"`
	IsDefault       bool    `json:"is_default"`
	SortOrder       int     `json:"sort_order"`
}

// UpdateVariationGroupRequest represents the request to update a global variation group
type UpdateVariationGroupRequest struct {
	Name          *string `json:"name"`
	SelectionType *string `json:"selection_type"`
	IsRequired    *bool   `json:"is_required"`
	MinSelections *int    `json:"min_selections"`
	MaxSelections *int    `json:"max_selections"`
	SortOrder     *int    `json:"sort_order"`
	IsActive      *bool   `json:"is_active"`
}

// LinkVariationsRequest represents the request to set product's global variation links with per-item prices
type LinkVariationsRequest struct {
	VariationGroups []LinkVariationGroupWithPrices `json:"variation_groups" binding:"required"`
}

// LinkVariationGroupWithPrices represents a variation group link with per-item prices
type LinkVariationGroupWithPrices struct {
	VariationGroupID string                  `json:"variation_group_id" binding:"required"`
	SortOrder        int                     `json:"sort_order"`
	ItemPrices       []LinkVariationItemPrice `json:"item_prices" binding:"required"`
}

// LinkVariationItemPrice represents a single item's price in the link request
type LinkVariationItemPrice struct {
	VariationItemID string  `json:"variation_item_id" binding:"required"`
	Price           float64 `json:"price" binding:"required"`
}

// ProductVariationLinkResponse is the response when fetching a product's linked variations with prices
type ProductVariationLinkResponse struct {
	VariationGroupID string                       `json:"variation_group_id"`
	GroupName        string                       `json:"group_name"`
	SelectionType    string                       `json:"selection_type"`
	IsRequired       bool                         `json:"is_required"`
	MinSelections    int                          `json:"min_selections"`
	MaxSelections    int                          `json:"max_selections"`
	SortOrder        int                          `json:"sort_order"`
	Items            []ProductVariationItemPrice  `json:"items"`
}

// ProductVariationItemPrice represents a variation item with its per-product price
type ProductVariationItemPrice struct {
	VariationItemID string  `json:"variation_item_id"`
	ItemName        string  `json:"item_name"`
	Price           float64 `json:"price"`
	IsDefault       bool    `json:"is_default"`
	IsAvailable     bool    `json:"is_available"`
	SortOrder       int     `json:"sort_order"`
}

// ComboSlot represents a slot in a combo product where the customer picks a product
type ComboSlot struct {
	ID         uuid.UUID          `json:"id"`
	ProductID  uuid.UUID          `json:"product_id"`
	Name       string             `json:"name"`
	IsRequired bool               `json:"is_required"`
	SortOrder  int                `json:"sort_order"`
	CreatedAt  time.Time          `json:"created_at"`
	UpdatedAt  time.Time          `json:"updated_at"`
	Choices    []ComboSlotChoice  `json:"choices,omitempty"`
}

// ComboSlotChoice represents a product that can fill a combo slot
type ComboSlotChoice struct {
	ID                uuid.UUID  `json:"id"`
	ComboSlotID       uuid.UUID  `json:"combo_slot_id"`
	ProductID         uuid.UUID  `json:"product_id"`
	VariationItemID   *uuid.UUID `json:"variation_item_id,omitempty"`
	VariationItemName string     `json:"variation_item_name,omitempty"`
	PriceOverride     *float64   `json:"price_override"` // nil = included, value = extra charge
	SortOrder         int        `json:"sort_order"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
	Product           *Product   `json:"product,omitempty"` // populated on read
}

// OrderItemComboChoice represents a combo slot choice saved with an order item (denormalized)
type OrderItemComboChoice struct {
	ID              uuid.UUID `json:"id"`
	OrderItemID     uuid.UUID `json:"order_item_id"`
	SlotName        string    `json:"slot_name"`
	ProductID       uuid.UUID `json:"product_id"`
	ProductName     string    `json:"product_name"`
	PriceAdjustment float64  `json:"price_adjustment"`
	SelectedOptions string    `json:"selected_options"` // JSON string of nested options
	CreatedAt       time.Time `json:"created_at"`
}

// CreateOrderItemComboChoice represents a combo choice in an order creation request
type CreateOrderItemComboChoice struct {
	SlotName        string                  `json:"slot_name"`
	ProductID       uuid.UUID               `json:"product_id"`
	ProductName     string                  `json:"product_name"`
	PriceAdjustment float64                 `json:"price_adjustment"`
	SelectedOptions []CreateOrderItemOption  `json:"selected_options"`
}

// CreateComboSlotRequest represents the request to create a combo slot
type CreateComboSlotRequest struct {
	Name       string                       `json:"name" binding:"required"`
	IsRequired bool                         `json:"is_required"`
	SortOrder  int                          `json:"sort_order"`
	Choices    []CreateComboSlotChoiceRequest `json:"choices"`
}

// CreateComboSlotChoiceRequest represents a choice within a combo slot creation request
type CreateComboSlotChoiceRequest struct {
	ProductID       uuid.UUID  `json:"product_id" binding:"required"`
	VariationItemID *uuid.UUID `json:"variation_item_id"`
	PriceOverride   *float64   `json:"price_override"`
	SortOrder       int        `json:"sort_order"`
}

// UpdateComboSlotRequest represents the request to update a combo slot
type UpdateComboSlotRequest struct {
	Name       *string `json:"name"`
	IsRequired *bool   `json:"is_required"`
	SortOrder  *int    `json:"sort_order"`
}

// PlatformConfig represents a platform integration configuration (Swiggy/Zomato)
type PlatformConfig struct {
	ID            uuid.UUID  `json:"id"`
	Platform      string     `json:"platform"`       // swiggy, zomato
	IsEnabled     bool       `json:"is_enabled"`
	APIKey        *string    `json:"api_key"`
	APISecret     *string    `json:"api_secret"`
	WebhookSecret *string    `json:"webhook_secret"`
	RestaurantID  *string    `json:"restaurant_id"`   // Platform's restaurant ID
	ConfigData    *string    `json:"config_data"`      // JSON string
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// CreatePlatformConfigRequest represents the request to create/update a platform config
type CreatePlatformConfigRequest struct {
	Platform      string  `json:"platform" binding:"required"`
	IsEnabled     bool    `json:"is_enabled"`
	APIKey        *string `json:"api_key"`
	APISecret     *string `json:"api_secret"`
	WebhookSecret *string `json:"webhook_secret"`
	RestaurantID  *string `json:"restaurant_id"`
	ConfigData    *string `json:"config_data"`
}

// AggregatorOrderWebhook represents an incoming order from an aggregator platform
type AggregatorOrderWebhook struct {
	ExternalOrderID      string                 `json:"external_order_id" binding:"required"`
	Platform             string                 `json:"platform" binding:"required"`
	CustomerName         *string                `json:"customer_name"`
	CustomerPhone        *string                `json:"customer_phone"`
	DeliveryPartnerName  *string                `json:"delivery_partner_name"`
	DeliveryPartnerPhone *string                `json:"delivery_partner_phone"`
	Items                []AggregatorOrderItem  `json:"items" binding:"required"`
	Subtotal             float64                `json:"subtotal"`
	TaxAmount            float64                `json:"tax_amount"`
	DiscountAmount       float64                `json:"discount_amount"`
	TotalAmount          float64                `json:"total_amount"`
	Notes                *string                `json:"notes"`
	AcceptDeadlineMinutes int                   `json:"accept_deadline_minutes"` // Minutes from now to accept
	ExternalData         map[string]interface{} `json:"external_data"`          // Raw platform payload
}

// AggregatorOrderItem represents an item in an aggregator order
type AggregatorOrderItem struct {
	ProductID           *uuid.UUID `json:"product_id"`            // Mapped POS product ID (optional)
	ExternalProductID   string     `json:"external_product_id"`   // Platform product ID
	Name                string     `json:"name" binding:"required"`
	Quantity            int        `json:"quantity" binding:"required"`
	UnitPrice           float64    `json:"unit_price"`
	TotalPrice          float64    `json:"total_price"`
	SpecialInstructions *string    `json:"special_instructions"`
}

// AggregatorStatusUpdate represents a status update from an aggregator platform
type AggregatorStatusUpdate struct {
	ExternalOrderID string `json:"external_order_id" binding:"required"`
	Status          string `json:"status" binding:"required"`
	DeliveryPartnerName  *string `json:"delivery_partner_name"`
	DeliveryPartnerPhone *string `json:"delivery_partner_phone"`
}

// RejectAggregatorOrderRequest represents the request to reject an aggregator order
type RejectAggregatorOrderRequest struct {
	Reason string `json:"reason" binding:"required"`
}
