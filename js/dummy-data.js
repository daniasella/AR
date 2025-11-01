// Dummy data generator for demo purposes
class DummyDataGenerator {
    constructor() {
        this.subscribers = [];
        this.currentData = {
            temperature: 25,
            humidity: 60,
            aqi: 50,
            weather: 'Cerah'
        };
        this.startGenerating();
    }

    startGenerating() {
        setInterval(() => {
            // Generate random variations
            this.currentData.temperature += (Math.random() - 0.5) * 2;
            this.currentData.humidity += (Math.random() - 0.5) * 5;
            this.currentData.aqi += (Math.random() - 0.5) * 10;
            
            // Keep values in realistic ranges
            this.currentData.temperature = Math.min(Math.max(this.currentData.temperature, 20), 35);
            this.currentData.humidity = Math.min(Math.max(this.currentData.humidity, 40), 90);
            this.currentData.aqi = Math.min(Math.max(this.currentData.aqi, 0), 200);

            // Update weather condition based on temperature
            if (this.currentData.temperature > 30) {
                this.currentData.weather = 'Panas';
            } else if (this.currentData.temperature < 23) {
                this.currentData.weather = 'Dingin';
            } else {
                this.currentData.weather = 'Cerah';
            }

            // Notify all subscribers
            this.notifySubscribers();
        }, 3000); // Update every 3 seconds
    }

    subscribe(callback) {
        this.subscribers.push(callback);
    }

    notifySubscribers() {
        this.subscribers.forEach(callback => callback({...this.currentData}));
    }
}

// Export singleton instance
export const dummyData = new DummyDataGenerator();