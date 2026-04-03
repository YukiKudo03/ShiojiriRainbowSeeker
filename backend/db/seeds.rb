# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Example:
#
#   ["Action", "Comedy", "Drama", "Horror"].each do |genre_name|
#     MovieGenre.find_or_create_by!(name: genre_name)
#   end

# --- Rainbow Moment seed data ---
if Rails.env.development? || Rails.env.staging?
  puts "Seeding Rainbow Moments..."

  locations = RainbowAlertJob::MONITORING_LOCATIONS

  5.times do |i|
    location = locations[i % locations.size]
    starts_at = (i + 1).days.ago + rand(6..18).hours
    ends_at = starts_at + rand(15..40).minutes

    moment = RainbowMoment.find_or_create_by!(
      location_id: location[:id],
      starts_at: starts_at
    ) do |m|
      m.ends_at = ends_at
      m.status = "archived"
      m.weather_snapshot = {
        temperature: rand(14.0..24.0).round(1),
        humidity: rand(60..85),
        cloud_cover: rand(30..70),
        sun_altitude: rand(10.0..40.0).round(1),
        weather_code: "500",
        weather_description: "light rain",
        visibility: rand(5000..10000),
        precipitation_mm: rand(0.5..3.0).round(1)
      }
      m.participants_count = rand(3..25)
      m.photos_count = rand(1..10)
    end

    puts "  Created moment #{moment.id} at #{location[:name]} (#{starts_at.strftime('%m/%d %H:%M')})"
  end

  puts "Rainbow Moments seeded!"
end
