import {Metadata} from "next";
import {buildLocationPlacesMetadata, LocationPlacesRouteProps, renderLocationPlacesPage} from "../_components/location-places-route";

export function generateMetadata(props: LocationPlacesRouteProps): Promise<Metadata> {
    return buildLocationPlacesMetadata(props, "zoos");
}

export default function LocationZoosPage(props: LocationPlacesRouteProps) {
    return renderLocationPlacesPage(props, "zoos");
}
