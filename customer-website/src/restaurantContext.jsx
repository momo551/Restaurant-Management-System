import { createContext, useContext, useEffect } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import Navbar from './components/Navbar';
import { useWebsiteStore } from './store/websiteStore';

const RestaurantContext = createContext(null);

export function RestaurantLayout() {
    const { restaurantSlug } = useParams();
    const fetchWebsite = useWebsiteStore((state) => state.fetchWebsite);

    useEffect(() => {
        if (restaurantSlug) fetchWebsite(restaurantSlug);
    }, [restaurantSlug, fetchWebsite]);

    return (
        <RestaurantContext.Provider value={restaurantSlug}>
            <Navbar />
            <Outlet />
        </RestaurantContext.Provider>
    );
}

export function useRestaurantSlug() {
    const restaurantSlug = useContext(RestaurantContext);
    if (!restaurantSlug) {
        throw new Error('A restaurant-specific public URL is required.');
    }
    return restaurantSlug;
}

export function restaurantPath(restaurantSlug, suffix = '') {
    return `/customer/${encodeURIComponent(restaurantSlug)}${suffix}`;
}
