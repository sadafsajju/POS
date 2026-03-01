package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

// ClerkService handles interactions with Clerk API
type ClerkService struct {
	secretKey string
	baseURL   string
}

// NewClerkService creates a new Clerk service
func NewClerkService() *ClerkService {
	secretKey := os.Getenv("CLERK_SECRET_KEY")
	return &ClerkService{
		secretKey: secretKey,
		baseURL:   "https://api.clerk.com/v1",
	}
}

// IsEnabled returns true if Clerk is configured
func (s *ClerkService) IsEnabled() bool {
	return s.secretKey != ""
}

// CreateUserRequest represents the request to create a Clerk user
type CreateUserRequest struct {
	EmailAddress         []string               `json:"email_address"`
	Password             string                 `json:"password,omitempty"`
	FirstName            string                 `json:"first_name,omitempty"`
	LastName             string                 `json:"last_name,omitempty"`
	SkipPasswordChecks   bool                   `json:"skip_password_checks,omitempty"`
	SkipPasswordRequirement bool                `json:"skip_password_requirement,omitempty"`
	UnsafeMetadata       map[string]interface{} `json:"unsafe_metadata,omitempty"`
	PublicMetadata       map[string]interface{} `json:"public_metadata,omitempty"`
}

// ClerkUserResponse represents the response from Clerk API
type ClerkUserResponse struct {
	ID             string                 `json:"id"`
	EmailAddresses []ClerkEmailAddress    `json:"email_addresses"`
	FirstName      string                 `json:"first_name"`
	LastName       string                 `json:"last_name"`
	UnsafeMetadata map[string]interface{} `json:"unsafe_metadata"`
	PublicMetadata map[string]interface{} `json:"public_metadata"`
}

// ClerkEmailAddress represents an email from Clerk
type ClerkEmailAddress struct {
	ID           string `json:"id"`
	EmailAddress string `json:"email_address"`
}

// CreateUser creates a new user in Clerk
func (s *ClerkService) CreateUser(email, firstName, lastName, role, password string, orgID, locationID string) (*ClerkUserResponse, error) {
	if !s.IsEnabled() {
		return nil, fmt.Errorf("clerk is not enabled")
	}

	// Prepare metadata to store POS-specific data
	unsafeMetadata := map[string]interface{}{
		"role":        role,
		"org_id":      orgID,
		"location_id": locationID,
	}

	reqBody := CreateUserRequest{
		EmailAddress:         []string{email},
		Password:             password,
		FirstName:            firstName,
		LastName:             lastName,
		SkipPasswordChecks:   true,
		SkipPasswordRequirement: false,
		UnsafeMetadata:       unsafeMetadata,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", s.baseURL+"/users", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.secretKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("clerk API error (status %d): %s", resp.StatusCode, string(body))
	}

	var userResp ClerkUserResponse
	if err := json.Unmarshal(body, &userResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &userResp, nil
}

// OrganizationResponse represents a Clerk organization
type OrganizationResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Slug      string `json:"slug"`
	CreatedAt int64  `json:"created_at"`
}

// OrganizationInvitationResponse represents the response from creating an organization invitation
type OrganizationInvitationResponse struct {
	ID               string `json:"id"`
	EmailAddress     string `json:"email_address"`
	OrganizationID   string `json:"organization_id"`
	Role             string `json:"role"`
	Status           string `json:"status"`
	CreatedAt        int64  `json:"created_at"`
}

// CreateOrganization creates a new Clerk organization for an admin user
func (s *ClerkService) CreateOrganization(name, createdBy string) (*OrganizationResponse, error) {
	if !s.IsEnabled() {
		return nil, fmt.Errorf("clerk is not enabled")
	}

	// Create organization with the provided name
	reqBody := map[string]interface{}{
		"name":       name,
		"created_by": createdBy, // Clerk user ID who is creating the org
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", s.baseURL+"/organizations", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.secretKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("clerk organization API error (status %d): %s", resp.StatusCode, string(body))
	}

	var orgResp OrganizationResponse
	if err := json.Unmarshal(body, &orgResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &orgResp, nil
}

// CreateOrganizationInvitation invites a user to an organization
// Clerk automatically sends an invitation email to the provided email address
func (s *ClerkService) CreateOrganizationInvitation(organizationID, email, role string) (*OrganizationInvitationResponse, error) {
	if !s.IsEnabled() {
		return nil, fmt.Errorf("clerk is not enabled")
	}

	// Get redirect URL from environment (where user goes after accepting invitation)
	redirectURL := os.Getenv("CLERK_INVITATION_REDIRECT_URL")
	if redirectURL == "" {
		redirectURL = "http://localhost:3000/login" // Default fallback
	}

	// Map POS roles to Clerk organization roles
	// Clerk only supports: "org:admin" and "org:member" (basic_member)
	// We'll map admin/manager to org:admin, all others to org:member
	clerkRole := "org:member" // Default for staff (server, counter, kitchen)
	if role == "admin" || role == "manager" {
		clerkRole = "org:admin"
	}

	reqBody := map[string]interface{}{
		"email_address": email,
		"role":          clerkRole, // Use Clerk's organization role format
		"redirect_url":  redirectURL,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// POST /organizations/{organization_id}/invitations
	req, err := http.NewRequest("POST", s.baseURL+"/organizations/"+organizationID+"/invitations", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.secretKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("clerk organization invitation API error (status %d): %s", resp.StatusCode, string(body))
	}

	var invitationResp OrganizationInvitationResponse
	if err := json.Unmarshal(body, &invitationResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &invitationResp, nil
}
