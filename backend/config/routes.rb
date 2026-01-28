Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Devise routes (required for Devise mailer mappings)
  # We skip most Devise controllers as we use custom API controllers
  # But we need confirmations for the URL helper
  # Note: passwords is not skipped to provide edit_user_password_url for mailer
  devise_for :users, skip: [ :sessions, :registrations ], controllers: {
    confirmations: "devise/confirmations"
  }

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # API v1 routes
  namespace :api do
    namespace :v1 do
      # Health check endpoints (detailed, for monitoring)
      # GET /api/v1/health       - Detailed health status (authenticated)
      # GET /api/v1/health/ready - Readiness probe (Kubernetes/Kamal)
      # GET /api/v1/health/live  - Liveness probe (Kubernetes/Kamal)
      get "health", to: "health#show"
      get "health/ready", to: "health#ready"
      get "health/live", to: "health#live"

      # Authentication endpoints
      # POST   /api/v1/auth/register       - User registration
      # POST   /api/v1/auth/login          - User login
      # DELETE /api/v1/auth/logout         - User logout
      # POST   /api/v1/auth/refresh        - Token refresh
      # POST   /api/v1/auth/password/reset - Password reset request
      # PUT    /api/v1/auth/password/reset - Password reset confirmation
      # GET    /api/v1/auth/verify_email/:token - Email verification
      namespace :auth do
        post "register", to: "/api/v1/auth#register"
        post "login", to: "/api/v1/auth#login"
        delete "logout", to: "/api/v1/auth#logout"
        post "refresh", to: "/api/v1/auth#refresh"
        post "password/reset", to: "/api/v1/auth#password_reset_request"
        put "password/reset", to: "/api/v1/auth#password_reset_confirm"
        get "verify_email/:token", to: "/api/v1/auth#verify_email"
      end

      # Photo endpoints
      # GET    /api/v1/photos             - List photos with filters
      # GET    /api/v1/photos/:id         - Show photo details
      # POST   /api/v1/photos             - Create new photo
      # PATCH  /api/v1/photos/:id         - Update photo metadata
      # DELETE /api/v1/photos/:id         - Delete photo
      # GET    /api/v1/photos/:id/weather - Get weather data for photo
      resources :photos, only: %i[index show create update destroy] do
        member do
          get :weather
        end
      end

      # Map endpoints
      # GET    /api/v1/maps/markers   - Get photo markers within bounds
      # GET    /api/v1/maps/clusters  - Get clustered markers within bounds
      # GET    /api/v1/maps/heatmap   - Get heatmap data within bounds
      namespace :maps do
        get :markers, to: "/api/v1/maps#markers"
        get :clusters, to: "/api/v1/maps#clusters"
        get :heatmap, to: "/api/v1/maps#heatmap"
      end

      # Social interaction endpoints (likes, comments, reports)
      # POST   /api/v1/photos/:photo_id/likes       - Add like to photo
      # DELETE /api/v1/photos/:photo_id/likes       - Remove like from photo
      # GET    /api/v1/photos/:photo_id/comments    - List comments for photo
      # POST   /api/v1/photos/:photo_id/comments    - Add comment to photo
      # DELETE /api/v1/comments/:id                 - Delete own comment
      # POST   /api/v1/reports                      - Report content
      resources :photos, only: [] do
        member do
          post :likes, to: "social#like"
          delete :likes, to: "social#unlike"
          get :comments, to: "social#comments"
          post :comments, to: "social#create_comment"
        end
      end
      resources :comments, only: [ :destroy ], controller: "social", action: :destroy_comment
      resources :reports, only: [ :create ], controller: "social", action: :create_report

      # Notification endpoints
      # GET    /api/v1/notifications           - List notifications
      # POST   /api/v1/notifications/mark_read - Mark notifications as read
      # GET    /api/v1/notifications/settings  - Get notification settings
      # PUT    /api/v1/notifications/settings  - Update notification settings
      # POST   /api/v1/notifications/devices   - Register device token
      # DELETE /api/v1/notifications/devices   - Unregister device token
      resources :notifications, only: [ :index ] do
        collection do
          post :mark_read
          get :settings, to: "notifications#settings_show"
          put :settings, to: "notifications#settings_update"
          post :devices, to: "notifications#register_device"
          delete :devices, to: "notifications#unregister_device"
        end
      end

      # User profile endpoints
      # GET    /api/v1/users/me                 - Get current user profile
      # PATCH  /api/v1/users/me                 - Update current user profile
      # GET    /api/v1/users/me/photos          - Get current user's photos
      # POST   /api/v1/users/me/export          - Request data export
      # POST   /api/v1/users/me/delete          - Request account deletion
      # DELETE /api/v1/users/me/delete          - Cancel deletion request
      # GET    /api/v1/users/me/deletion_status - Get deletion status
      # GET    /api/v1/users/:id                - Get public user profile
      # GET    /api/v1/users/:id/photos         - Get user's public photos
      resources :users, only: [ :show ] do
        collection do
          get :me, to: "users#me"
          patch :me, to: "users#update_me"
          put :me, to: "users#update_me"
          get "me/photos", to: "users#my_photos"
          # Data management endpoints (FR-12)
          post "me/export", to: "users#request_export"
          post "me/delete", to: "users#request_deletion"
          delete "me/delete", to: "users#cancel_deletion"
          get "me/deletion_status", to: "users#deletion_status"
        end
        member do
          get :photos, to: "users#user_photos"
        end
      end

      # Statistics endpoints (public, for research/dashboard)
      # GET    /api/v1/statistics/regions              - List available regions
      # GET    /api/v1/statistics/region/:region_id    - Get region statistics
      # GET    /api/v1/statistics/trends               - Get rainbow occurrence trends
      # GET    /api/v1/statistics/weather              - Get weather correlations
      # GET    /api/v1/statistics/compare              - Compare multiple regions
      # GET    /api/v1/statistics/export               - Export dataset for research
      scope :statistics, controller: :statistics do
        get :regions
        get "region/:region_id", action: :region_stats, as: :statistics_region_stats
        get :trends
        get "weather", action: :weather_correlations
        get :compare
        get :export
      end

      # Admin endpoints (requires admin role)
      # GET    /api/v1/admin/reports               - List reports
      # GET    /api/v1/admin/reports/:id           - Show report details
      # POST   /api/v1/admin/reports/:id/process   - Process report (approve/hide/delete)
      namespace :admin do
        resources :reports, only: %i[index show] do
          member do
            post :process, to: "reports#process_report", as: :process
          end
        end
      end
    end
  end

  # Defines the root path route ("/")
  # root "posts#index"
end
